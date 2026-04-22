// src/lib/tokens.ts
// NOTE: Uses @anthropic-ai/tokenizer for all providers (Anthropic/OpenAI/Gemini/Qwen).
// This is a conservative approximation — actual token counts on non-Anthropic providers
// will differ. Monitor logs for "context exceeded" errors from provider SDKs; if they
// appear, swap in provider-specific tokenizers (js-tiktoken for OpenAI, etc.).
import { countTokens } from "@anthropic-ai/tokenizer";

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return countTokens(text);
}

export function estimateMessagesTokens(
  messages: Array<{
    role: string;
    content: string | null;
    tool_calls?: unknown;
    tool_call_id?: string | null;
    tool_name?: string | null;
  }>
): number {
  let total = 0;
  for (const m of messages) {
    total += 4; // role framing overhead
    if (m.content) total += estimateTokens(m.content);
    if (m.tool_calls) total += estimateTokens(JSON.stringify(m.tool_calls));
    if (m.tool_name) total += estimateTokens(m.tool_name);
  }
  return total;
}
