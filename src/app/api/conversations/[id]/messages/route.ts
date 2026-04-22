// src/app/api/conversations/[id]/messages/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getConversation,
  loadMessages,
  sliceFromLatestCompaction,
  type DbMessage,
} from "@/lib/conversation";

type ToolState = "input-available" | "output-available" | "output-error";

type UIMessagePart =
  | { type: "text"; text: string }
  | {
      type: `tool-${string}`;
      toolCallId: string;
      state: ToolState;
      input: unknown;
      output?: unknown;
      errorText?: string;
    };

type UIMessage = { id: string; role: "user" | "assistant"; parts: UIMessagePart[] };

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function toUIMessages(rows: DbMessage[]): UIMessage[] {
  const out: UIMessage[] = [];

  // Index tool results by tool_call_id for merging into the assistant tool part.
  const toolResults = new Map<string, { toolName: string; output: unknown }>();
  for (const r of rows) {
    if (r.role === "tool" && r.tool_call_id && r.tool_name) {
      toolResults.set(r.tool_call_id, {
        toolName: r.tool_name,
        output: safeParse(r.content),
      });
    }
  }

  for (const r of rows) {
    if (r.role === "compaction") continue; // returned as earlierSummary
    if (r.role === "tool") continue;        // merged into assistant parts

    if (r.role === "user") {
      out.push({
        id: `m_${r.id}`,
        role: "user",
        parts: [{ type: "text", text: r.content ?? "" }],
      });
      continue;
    }

    // assistant
    const parts: UIMessagePart[] = [];
    if (r.content) parts.push({ type: "text", text: r.content });
    if (Array.isArray(r.tool_calls)) {
      for (const tc of r.tool_calls as Array<{ id: string; name: string; args: unknown }>) {
        const result = toolResults.get(tc.id);
        parts.push({
          type: `tool-${tc.name}`,
          toolCallId: tc.id,
          state: result ? "output-available" : "input-available",
          input: tc.args,
          output: result?.output,
        });
      }
    }
    out.push({ id: `m_${r.id}`, role: "assistant", parts });
  }
  return out;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const conv = await getConversation(id, session.user.id);
  if (!conv) return new NextResponse("Not found", { status: 404 });
  const all = await loadMessages(id);
  const slice = sliceFromLatestCompaction(all);

  // Compaction (if present) is always the first element of the slice.
  const compactionRow = slice[0]?.role === "compaction" ? slice[0] : null;
  const tail = compactionRow ? slice.slice(1) : slice;

  return NextResponse.json({
    conversation: { id: conv.id, title: conv.title, model: conv.model },
    earlierSummary: compactionRow?.content ?? null,
    messages: toUIMessages(tail),
  });
}
