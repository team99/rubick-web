import { describe, it, expect } from "vitest";
import { splitForCompaction } from "@/lib/compaction";
import type { DbMessage } from "@/lib/conversation";

const mk = (id: number, role: DbMessage["role"], extra: Partial<DbMessage> = {}): DbMessage => ({
  id, conversation_id: "c1", role, content: `m${id}`,
  tool_calls: null, tool_call_id: null, tool_name: null, metadata: null,
  created_at: new Date(), ...extra,
});

describe("splitForCompaction", () => {
  it("splits cleanly when cut falls between turns", () => {
    const rows = [mk(1, "user"), mk(2, "assistant"), mk(3, "user"), mk(4, "assistant")];
    const { toSummarize, toKeep } = splitForCompaction(rows, 2);
    expect(toSummarize.map((m) => m.id)).toEqual([1, 2]);
    expect(toKeep.map((m) => m.id)).toEqual([3, 4]);
  });

  it("pushes cut forward to after tool result when cut falls between tool_call and tool", () => {
    const rows = [
      mk(1, "user"),
      mk(2, "assistant", { tool_calls: [{ id: "tc_1", name: "get_schema" }] }),
      mk(3, "tool", { tool_call_id: "tc_1", tool_name: "get_schema" }),
      mk(4, "assistant"),
      mk(5, "user"),
    ];
    // Proposed cut is 3, which would leave tool_call (id=2) orphaned in toSummarize
    // while tool result (id=3) stays in toKeep — wait, 3 means "first 3 rows".
    // We cut after 2 items, which separates tool_call from its tool result.
    const { toSummarize, toKeep } = splitForCompaction(rows, 2);
    // Should be pushed forward to include the tool result AND the final assistant response
    // for that tool use (assistant row 4). Minimal safe extension: through row 4.
    expect(toSummarize.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(toKeep.map((m) => m.id)).toEqual([5]);
  });

  it("handles multiple tool_calls in one assistant message", () => {
    const rows = [
      mk(1, "assistant", { tool_calls: [{ id: "tc_a" }, { id: "tc_b" }] }),
      mk(2, "tool", { tool_call_id: "tc_a", tool_name: "f" }),
      mk(3, "tool", { tool_call_id: "tc_b", tool_name: "g" }),
      mk(4, "assistant"),
      mk(5, "user"),
    ];
    const { toSummarize, toKeep } = splitForCompaction(rows, 1);
    expect(toSummarize.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(toKeep.map((m) => m.id)).toEqual([5]);
  });

  it("returns empty toSummarize when cut is 0", () => {
    const rows = [mk(1, "user"), mk(2, "assistant")];
    const { toSummarize, toKeep } = splitForCompaction(rows, 0);
    expect(toSummarize).toEqual([]);
    expect(toKeep.map((m) => m.id)).toEqual([1, 2]);
  });
});
