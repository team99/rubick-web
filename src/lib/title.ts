// src/lib/title.ts
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { setTitle } from "@/lib/conversation";

const TITLE_SYSTEM = `You name chat conversations. Rules:
- Max 60 characters.
- Title Case.
- No quotes, no trailing punctuation.
- Describe the DATA question, not the chat itself (e.g. "April Enquiries by Agent" not "Asking About Enquiries").
- Output ONLY the title, nothing else.`;

function pickTitler() {
  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })("claude-haiku-4-5");
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })("gpt-4.1-mini");
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(
      "gemini-2.5-flash"
    );
  }
  return null;
}

function sanitize(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!?]+$/g, "")
    .slice(0, 60);
}

// I3: one retry with 2s backoff; swallow final failure (no user-facing surface).
async function callWithOneRetry<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); }
  catch (err1) {
    console.warn("[title] first attempt failed", err1 instanceof Error ? err1.message : err1);
    await new Promise(r => setTimeout(r, 2000));
    try { return await fn(); }
    catch (err2) {
      console.warn("[title] retry failed — leaving as 'New chat'", err2 instanceof Error ? err2.message : err2);
      return null;
    }
  }
}

/** Fire-and-forget. Safe to call without awaiting. */
export async function generateTitle(params: {
  conversationId: string;
  firstUserMessage: string;
  firstAssistantMessage: string;
}): Promise<void> {
  const model = pickTitler();
  if (!model) return;
  const result = await callWithOneRetry(() =>
    generateText({
      model,
      system: TITLE_SYSTEM,
      prompt: `User asked:\n${params.firstUserMessage.slice(0, 1500)}\n\nAssistant answered:\n${params.firstAssistantMessage.slice(0, 1500)}\n\nTitle:`,
    })
  );
  if (!result) return; // both attempts failed; leave title as "New chat"
  const title = sanitize(result.text);
  if (title) await setTitle(params.conversationId, title);
}
