// src/lib/__tests__/conversation.test.ts
import { describe, it, expect } from "vitest";
import { sliceFromLatestCompaction, type DbMessage } from "@/lib/conversation";

const mk = (id: number, role: DbMessage["role"], extra: Partial<DbMessage> = {}): DbMessage => ({
  id,
  conversation_id: "c1",
  role,
  content: `msg-${id}`,
  tool_calls: null,
  tool_call_id: null,
  tool_name: null,
  metadata: null,
  created_at: new Date(),
  ...extra,
});

describe("sliceFromLatestCompaction", () => {
  it("returns all messages when no compaction present", () => {
    const rows = [mk(1, "user"), mk(2, "assistant"), mk(3, "user")];
    expect(sliceFromLatestCompaction(rows).map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("returns from the latest compaction onward (inclusive)", () => {
    const rows = [
      mk(1, "user"),
      mk(2, "assistant"),
      mk(3, "compaction"),
      mk(4, "user"),
      mk(5, "assistant"),
    ];
    expect(sliceFromLatestCompaction(rows).map((m) => m.id)).toEqual([3, 4, 5]);
  });

  it("picks the latest compaction when multiple exist", () => {
    const rows = [
      mk(1, "compaction"),
      mk(2, "user"),
      mk(3, "compaction"),
      mk(4, "user"),
    ];
    expect(sliceFromLatestCompaction(rows).map((m) => m.id)).toEqual([3, 4]);
  });

  it("returns [compaction] when compaction row is most recent", () => {
    const rows = [
      { id: 1, role: "user", content: "hi" },
      { id: 2, role: "assistant", content: "hello" },
      { id: 3, role: "compaction", content: "## Conversation summary\n..." },
    ];
    const result = sliceFromLatestCompaction(rows as any);
    expect(result).toEqual([rows[2]]);
  });
});
