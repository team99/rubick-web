import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { getModelConfig, MODELS } from "@/lib/models";
import { getSlimContext, getSchemaFiles, getSchemaFileList } from "@/lib/es-context";
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

const PROVIDER_KEY_MAP = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  qwen: "DASHSCOPE_API_KEY",
} as const;

function getLanguageModel(modelId: string) {
  const config = getModelConfig(modelId);
  const envKey = PROVIDER_KEY_MAP[config.provider];
  const apiKey = process.env[envKey];

  if (!apiKey) {
    throw new Error(
      `API key not configured for ${config.name}. Set ${envKey} in .env.local`
    );
  }

  switch (config.provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(config.modelId);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(config.modelId);
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(config.modelId);
    }
    case "qwen": {
      const qwen = createOpenAI({
        apiKey,
        baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      });
      return qwen(config.modelId);
    }
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

function buildSystemPrompt(): string {
  const schemaIds = getSchemaFileList();
  return `You are Rubick, a data assistant for Rumah123 and iProperty. You help users query and analyze data from Elasticsearch indices.

You have two tools:
1. **get_schema** — Load detailed field documentation for specific indices. Call this FIRST before querying to learn exact field names, types, and enum values. Available schemas: ${schemaIds.join(", ")}
2. **execute_es_query** — Execute an Elasticsearch query.

Workflow:
1. Read the index overview below to identify which indices you need
2. Call get_schema to load their detailed schemas (typically 1-3 indices)
3. Call execute_es_query with accurate field names from the schema
4. Present results clearly with tables, bold numbers, and concise summaries

For simple queries using only fields listed in the "Key Fields per Index" table below (e.g., count by date, filter by status), you may skip get_schema and query directly.

Important guidelines:
- Always briefly explain your plan before calling tools (e.g., "I'll query the enquiries index for this month's data, then look up agent names.")
- Between tool calls, briefly explain what you found and what you'll do next
- Use "filter" context in bool queries for exact matches (faster, cacheable)
- Always exclude deleted records with instance_info.is_removed: false where applicable
- For active listings, filter by status: "1"
- For agents, filter by type.value: 1
- Use .keyword suffix for exact string matches on text fields
- Prices are in IDR (Indonesian Rupiah) for Rumah123, SGD for iProperty
- When showing prices, format them readably (e.g., "1.5B IDR" instead of "1500000000")
- Keep your answers concise and data-driven
- ALWAYS use markdown pipe table syntax for tabular data (e.g., | Col1 | Col2 |\n|---|---|\n| val1 | val2 |). Never use plain text or tab-separated tables.

---

${getSlimContext()}`;
}

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

  let languageModel;
  try {
    languageModel = getLanguageModel(modelId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Model not available";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const modelMessages = await convertToModelMessages(
    messages as UIMessage[]
  );

  const result = streamText({
    model: languageModel,
    system: buildSystemPrompt(),
    messages: modelMessages,
    tools: {
      get_schema: {
        description:
          "Load detailed schema documentation for specific Elasticsearch indices. Call this BEFORE execute_es_query to learn exact field names, types, .keyword suffixes, and enum values. Request only the indices you need (typically 1-3).",
        inputSchema: z.object({
          indices: z
            .array(z.string())
            .describe(
              "Array of index identifiers to load schemas for, e.g. ['enquiries', 'users']. Valid values: " +
                getSchemaFileList().join(", ")
            ),
        }),
        execute: async ({ indices }: { indices: string[] }) => {
          console.log(`[Tool Call] get_schema indices=${JSON.stringify(indices)}`);
          const content = getSchemaFiles(indices);
          console.log(`[Tool Result] get_schema loaded ${indices.length} schema(s), ${content.length} chars`);
          return { schemas: content };
        },
      },
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
          console.log(`[Tool Call] execute_es_query index="${index}"`, JSON.stringify(query, null, 2));
          try {
            const esResult = await executeESQuery(index, query);

            const hits =
              (esResult.hits as Record<string, unknown>) || {};
            const total = hits.total;
            const hitsArray =
              (hits.hits as Array<Record<string, unknown>>) || [];
            const aggregations = esResult.aggregations;

            const result = {
              total,
              hits_count: hitsArray.length,
              hits: hitsArray.slice(0, 20).map((h) => ({
                _id: h._id,
                _source: h._source,
              })),
              aggregations: aggregations || null,
            };
            console.log(`[Tool Result] total=${JSON.stringify(total)} hits_count=${hitsArray.length} has_aggs=${!!aggregations}`);
            return result;
          } catch (error: unknown) {
            const esError = error instanceof Error ? error.message : String(error);
            console.error(`[Tool Error] ${esError}`);
            const isPermission = esError.includes("not permitted");
            const toolError = {
              error: isPermission
                ? "That index is not available for querying."
                : "Failed to execute Elasticsearch query. Please try a different query.",
            };
            console.log(`[Tool Error Response]`, JSON.stringify(toolError));
            return toolError;
          }
        },
      },
    },
    stopWhen: stepCountIs(20),
  });

  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, steps: 0 };

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === "finish-step") {
        const input = part.usage.inputTokens ?? 0;
        const output = part.usage.outputTokens ?? 0;
        usage.inputTokens += input;
        usage.outputTokens += output;
        usage.totalTokens += input + output;
        usage.steps += 1;
        console.log(`[Step ${usage.steps}] in=${input} out=${output} (cumulative: ${usage.totalTokens})`);
        return { usage: { ...usage }, model: modelId };
      }
      if (part.type === "start") {
        return { usage: null, model: modelId };
      }
      return undefined;
    },
  });
}
