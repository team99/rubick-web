import { streamText, stepCountIs, type ModelMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { getModelConfig, MODELS } from "@/lib/models";
import { getESContext } from "@/lib/es-context";
import { executeESQuery } from "@/lib/es-client";
import { verifyAuth } from "@/lib/auth";

export const maxDuration = 120;

const validModelIds = new Set(MODELS.map((m) => m.id));

const requestSchema = z.object({
  messages: z.array(z.unknown()).min(1),
  model: z.string().refine((id) => validModelIds.has(id), {
    message: "Invalid model ID",
  }),
});

function getLanguageModel(modelId: string) {
  const config = getModelConfig(modelId);

  switch (config.provider) {
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(config.modelId);
    }
    case "openai": {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      return openai(config.modelId);
    }
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google(config.modelId);
    }
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

const SYSTEM_PROMPT = `You are Rubick, a data assistant for Rumah123 and iProperty. You help users query and analyze data from Elasticsearch indices.

You have access to an Elasticsearch cluster with production data. When users ask questions about data, you should:

1. Understand what they're asking based on the schema context provided below
2. Use the execute_es_query tool to run Elasticsearch queries
3. Analyze the results and present them in a clear, readable format
4. Use tables for tabular data, lists for enumerations, and bold for key numbers

Important guidelines:
- Always use the correct index name from the schema documentation
- Use "filter" context in bool queries for exact matches (it's faster)
- Always exclude deleted records with instance_info.is_removed: false where applicable
- For active listings, filter by status: "1"
- For agents, filter by type.value: 1
- Use .keyword suffix for exact string matches on text fields
- Prices are in IDR (Indonesian Rupiah) for Rumah123, SGD for iProperty
- Portal ID 1 = Rumah123, Portal ID 2 = iProperty
- When showing prices, format them readably (e.g., "1.5B IDR" instead of "1500000000")
- Keep your answers concise and data-driven
- If a query returns no results, explain what was searched and suggest alternatives
- When you get large result sets, summarize the key findings rather than listing everything

Below is the complete Elasticsearch schema documentation:

---

${getESContext()}`;

export async function POST(req: Request) {
  const authenticated = await verifyAuth();
  if (!authenticated) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid request", details: parsed.error.issues }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, model: modelId } = parsed.data;
  const languageModel = getLanguageModel(modelId);

  const result = streamText({
    model: languageModel,
    system: SYSTEM_PROMPT,
    messages: messages as ModelMessage[],
    tools: {
      execute_es_query: {
        description:
          "Execute an Elasticsearch query against the Rumah123/iProperty cluster. Use this to search, aggregate, and analyze data.",
        inputSchema: z.object({
          index: z
            .string()
            .describe(
              "The Elasticsearch index to query (e.g., 'enquiries', 'listings-r123-*', 'users')"
            ),
          query: z
            .record(z.string(), z.unknown())
            .describe(
              "The Elasticsearch query body as a JSON object. Include query, aggs, size, sort, etc."
            ),
        }),
        execute: async ({
          index,
          query,
        }: {
          index: string;
          query: Record<string, unknown>;
        }) => {
          try {
            const esResult = await executeESQuery(index, query);

            const hits =
              (esResult.hits as Record<string, unknown>) || {};
            const total = hits.total;
            const hitsArray =
              (hits.hits as Array<Record<string, unknown>>) || [];
            const aggregations = esResult.aggregations;

            return {
              total,
              hits_count: hitsArray.length,
              hits: hitsArray.slice(0, 20).map((h) => ({
                _id: h._id,
                _source: h._source,
              })),
              aggregations: aggregations || null,
            };
          } catch (error: unknown) {
            // Return generic error — don't leak ES internals
            console.error("[ES Query Error]", error);
            const isPermission =
              error instanceof Error && error.message.includes("not permitted");
            return {
              error: isPermission
                ? "That index is not available for querying."
                : "Failed to execute Elasticsearch query. Please try a different query.",
            };
          }
        },
      },
    },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
