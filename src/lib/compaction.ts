// src/lib/compaction.ts
import type { DbMessage } from "@/lib/conversation";
import { getModelConfig, type ModelConfig } from "@/lib/models";

export const COMPACTION_THRESHOLD: Record<ModelConfig["provider"], number> = {
  anthropic: 150_000,
  openai: 150_000,
  google: 700_000,
  qwen: 700_000,
};

export function thresholdFor(modelId: string): number {
  const cfg = getModelConfig(modelId);
  if (cfg.modelId.includes("qwen-long")) return Infinity;
  return COMPACTION_THRESHOLD[cfg.provider];
}

/**
 * Split messages at `cutAfter` (number of items to summarize), pushing the cut
 * forward if it would separate an assistant(tool_calls) row from any of its
 * corresponding tool result rows, or from the immediately following assistant
 * response that interpreted those results.
 */
export function splitForCompaction(
  rows: DbMessage[],
  cutAfter: number
): { toSummarize: DbMessage[]; toKeep: DbMessage[] } {
  let idx = Math.max(0, Math.min(cutAfter, rows.length));

  // Walk forward past any open tool-call/tool-result pairs or incomplete
  // assistant turn. A "safe" cut boundary is one where all tool_call ids
  // issued in toSummarize have matching tool results in toSummarize, AND
  // the next message is not a tool result referencing a call in toSummarize.
  while (idx < rows.length) {
    const left = rows.slice(0, idx);
    const right = rows.slice(idx);

    const openCallIds = new Set<string>();
    for (const m of left) {
      if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls as Array<{ id?: string }>) {
          if (tc.id) openCallIds.add(tc.id);
        }
      }
      if (m.role === "tool" && m.tool_call_id) {
        openCallIds.delete(m.tool_call_id);
      }
    }

    // If any tool call in `left` is unmatched, extend forward to include
    // its tool result AND the next assistant response (which interprets it).
    if (openCallIds.size > 0) {
      idx++;
      continue;
    }
    // If the next message is a tool result of a call in left (can't happen
    // because we cleared the set above), same thing. Otherwise we're safe.
    // Also: if the message right before `idx` is a tool result, include the
    // following assistant turn so the summary is semantically complete.
    const last = left[left.length - 1];
    if (last?.role === "tool" && right[0]?.role === "assistant") {
      idx++;
      continue;
    }
    break;
  }

  return { toSummarize: rows.slice(0, idx), toKeep: rows.slice(idx) };
}
