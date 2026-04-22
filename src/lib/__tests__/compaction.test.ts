import { describe, it, expect, vi, beforeEach } from "vitest";
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

// ---------------------------------------------------------------------------
// maybeCompact — mocked LLM + DB tests
// ---------------------------------------------------------------------------

const { generateTextMock, loadMessagesMock, appendMessageMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  loadMessagesMock: vi.fn(),
  appendMessageMock: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: generateTextMock,
}));

vi.mock("@/lib/conversation", async () => {
  // Re-export the real DbMessage type by importing from the real module is
  // not needed — tests only use the runtime functions. DbMessage is a type-only
  // import in the consumer.
  return {
    loadMessages: loadMessagesMock,
    appendMessage: appendMessageMock,
    sliceFromLatestCompaction: (rows: DbMessage[]) => {
      let cutIdx = -1;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].role === "compaction") { cutIdx = i; break; }
      }
      return cutIdx === -1 ? rows : rows.slice(cutIdx);
    },
  };
});

const WELL_FORMED_SUMMARY = [
  "## Conversation summary",
  "Some summary text.",
  "### Current task",
  "Analyze April enquiries.",
  "### Data focus",
  "None.",
  "### Established findings",
  "None.",
  "### Decisions made",
  "None.",
  "### Open items",
  "None.",
].join("\n");

// Build a big conversation that exceeds the threshold for qwen36-plus (700_000).
// Each message carries ~20k tokens worth of content (a long repeated string)
// so ~40 messages easily exceed 700k.
function bigConversation(n: number): DbMessage[] {
  const chunk = "lorem ipsum dolor sit amet ".repeat(4000); // ~80k chars
  const rows: DbMessage[] = [];
  for (let i = 1; i <= n; i++) {
    rows.push({
      id: i,
      conversation_id: "c1",
      role: i % 2 === 1 ? "user" : "assistant",
      content: chunk,
      tool_calls: null,
      tool_call_id: null,
      tool_name: null,
      metadata: null,
      created_at: new Date(),
    });
  }
  return rows;
}

describe("maybeCompact", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    loadMessagesMock.mockReset();
    appendMessageMock.mockReset();
    // Ensure pickSummarizer finds a key.
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("returns compacted=false and does not call generateText when under threshold", async () => {
    const { maybeCompact } = await import("@/lib/compaction");
    loadMessagesMock.mockResolvedValue([
      mk(1, "user"),
      mk(2, "assistant"),
      mk(3, "user"),
    ]);

    const result = await maybeCompact("c1", "qwen36-plus");

    expect(result).toEqual({ compacted: false });
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(appendMessageMock).not.toHaveBeenCalled();
  });

  it("writes a compaction row with well-formed metadata when summarizer returns valid markdown", async () => {
    const { maybeCompact } = await import("@/lib/compaction");
    const rows = bigConversation(40);
    loadMessagesMock.mockResolvedValue(rows);
    generateTextMock.mockResolvedValue({ text: WELL_FORMED_SUMMARY });
    appendMessageMock.mockResolvedValue({ id: 999 });

    const result = await maybeCompact("c1", "qwen36-plus");

    expect(generateTextMock).toHaveBeenCalledOnce();
    expect(appendMessageMock).toHaveBeenCalledOnce();
    const payload = appendMessageMock.mock.calls[0][0];
    expect(payload.conversation_id).toBe("c1");
    expect(payload.role).toBe("compaction");
    expect(payload.content).toBe(WELL_FORMED_SUMMARY);
    expect(payload.metadata).toMatchObject({
      prompt_version: "compaction_prompt_v1",
    });
    expect(typeof payload.metadata.summarized_through_message_id).toBe("number");
    expect(typeof payload.metadata.pre_tokens).toBe("number");
    expect(typeof payload.metadata.post_tokens).toBe("number");
    expect(typeof payload.metadata.summarizer_model).toBe("string");
    expect(result).toMatchObject({ compacted: true, summary: WELL_FORMED_SUMMARY });
  });

  it("refuses to persist a malformed summary missing required headings (I5)", async () => {
    const { maybeCompact } = await import("@/lib/compaction");
    const rows = bigConversation(40);
    loadMessagesMock.mockResolvedValue(rows);
    // Missing "### Open items"
    const malformed = [
      "## Conversation summary",
      "x",
      "### Current task",
      "x",
      "### Data focus",
      "x",
      "### Established findings",
      "x",
      "### Decisions made",
      "x",
    ].join("\n");
    generateTextMock.mockResolvedValue({ text: malformed });

    const result = await maybeCompact("c1", "qwen36-plus");

    expect(generateTextMock).toHaveBeenCalledOnce();
    expect(appendMessageMock).not.toHaveBeenCalled();
    expect(result).toEqual({ compacted: false });
  });

  it("rejects a summary that only embeds heading strings inside bullet text (I3)", async () => {
    const { maybeCompact } = await import("@/lib/compaction");
    const rows = bigConversation(40);
    loadMessagesMock.mockResolvedValue(rows);
    // Adversarial: looks like it contains the headings, but they're all
    // inside bullet lines — not real line-anchored markdown headings.
    const adversarial = [
      "Here is a rundown:",
      '- "## Conversation summary" was mentioned',
      '- "### Current task" was mentioned',
      '- "### Data focus" was mentioned',
      '- "### Established findings" was mentioned',
      '- "### Decisions made" was mentioned',
      '- "### Open items" was mentioned',
    ].join("\n");
    generateTextMock.mockResolvedValue({ text: adversarial });

    const result = await maybeCompact("c1", "qwen36-plus");

    expect(generateTextMock).toHaveBeenCalledOnce();
    expect(appendMessageMock).not.toHaveBeenCalled();
    expect(result).toEqual({ compacted: false });
  });

  it("preserves the latest user message when a single message exceeds keepBudget (I1)", async () => {
    const { maybeCompact } = await import("@/lib/compaction");
    // Build a conversation where EVERY message is huge enough to individually
    // exceed the 25% keep budget. Without the clamp, the backward walk would
    // push keepFromIdx past the last user row, leaving toKeep empty.
    const rows = bigConversation(40);
    // Force the final row to be a user message so the clamp has a target.
    rows[rows.length - 1] = {
      ...rows[rows.length - 1],
      role: "user",
    };
    loadMessagesMock.mockResolvedValue(rows);
    generateTextMock.mockResolvedValue({ text: WELL_FORMED_SUMMARY });
    appendMessageMock.mockResolvedValue({ id: 999 });

    const result = await maybeCompact("c1", "qwen36-plus");

    expect(result).toMatchObject({ compacted: true });
    expect(appendMessageMock).toHaveBeenCalledOnce();
    // toSummarize must stop BEFORE the last user row — i.e., the last
    // summarized message id must be less than the final user message id.
    const payload = appendMessageMock.mock.calls[0][0];
    expect(payload.metadata.summarized_through_message_id).toBeLessThan(rows[rows.length - 1].id);
  });
});
