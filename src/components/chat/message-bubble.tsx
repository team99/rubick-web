"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UIMessage } from "ai";

function ToolStatus({ input, isComplete }: { input: Record<string, unknown>; isComplete: boolean }) {
  const index = String(input?.index || "unknown");

  return (
    <div className="my-1.5 flex items-center gap-2 text-xs text-[#6B6B6B]">
      {isComplete ? (
        <svg width="12" height="12" viewBox="0 0 12 12" className="text-[#D97706] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2.5 6.5L5 9L9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <div className="animate-spin h-3 w-3 border border-[#D97706] border-t-transparent rounded-full shrink-0" />
      )}
      <span>{isComplete ? `Queried ${index}` : `Querying ${index}...`}</span>
    </div>
  );
}

interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  steps: number;
}

function UsageBadge({ usage, model }: { usage: UsageInfo; model?: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-[11px] text-[#999999] dark:text-[#666666]">
      <span>{usage.totalTokens.toLocaleString()} tokens</span>
      <span className="text-[#CCCCCC] dark:text-[#444444]">|</span>
      <span>{usage.inputTokens.toLocaleString()} in</span>
      <span className="text-[#CCCCCC] dark:text-[#444444]">|</span>
      <span>{usage.outputTokens.toLocaleString()} out</span>
      {usage.steps > 1 && (
        <>
          <span className="text-[#CCCCCC] dark:text-[#444444]">|</span>
          <span>{usage.steps} steps</span>
        </>
      )}
      {model && (
        <>
          <span className="text-[#CCCCCC] dark:text-[#444444]">|</span>
          <span>{model}</span>
        </>
      )}
    </div>
  );
}

// Extract tool info from a part using v6 property names
function getToolInfo(part: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = part as any;
  return {
    input: (p.input ?? {}) as Record<string, unknown>,
    output: p.output as Record<string, unknown> | undefined,
    state: p.state as string,
  };
}

interface MessageBubbleProps {
  message: UIMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const { role, parts } = message;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = (message as any).metadata as { usage?: UsageInfo; model?: string } | undefined;

  if (role === "user") {
    const text = parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-[#F0EDE8] dark:bg-[#2A2A2A] text-[15px] leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      </div>
    );
  }

  // Show "Thinking..." when streaming and model is not actively producing text or running a tool
  const lastPart = parts[parts.length - 1];
  const lastPartIsText = lastPart?.type === "text" && !!(lastPart as { type: "text"; text: string }).text;
  const lastPartIsTool = lastPart && (lastPart.type.startsWith("tool-") || lastPart.type === "dynamic-tool");
  const lastToolIsActive = lastPartIsTool && (() => {
    const { state, output } = getToolInfo(lastPart);
    return state !== "result" && !output;
  })();
  const showThinking = isStreaming && !lastPartIsText && !lastToolIsActive;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] text-[15px] leading-relaxed">
        {parts.map((part, i) => {
          if (part.type === "text") {
            const text = (part as { type: "text"; text: string }).text;
            if (!text) return null;
            return (
              <div
                key={i}
                className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-[#1A1A1A] dark:prose-headings:text-[#E8E8E8] prose-p:text-[#1A1A1A] dark:prose-p:text-[#E8E8E8] prose-code:bg-[#F5F2EB] dark:prose-code:bg-[#262626] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-[#F5F2EB] dark:prose-pre:bg-[#1E1E1E] prose-pre:border prose-pre:border-[#E5E3DC] dark:prose-pre:border-[#333333] prose-table:text-sm prose-th:bg-[#F5F5F0] dark:prose-th:bg-[#262626] prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border-[#E5E3DC] dark:prose-td:border-[#333333]"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  disallowedElements={["script", "iframe", "object", "embed"]}
                >
                  {text}
                </ReactMarkdown>
              </div>
            );
          }

          // Tool calls: show as brief status line
          if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
            const { input, output, state } = getToolInfo(part);
            const isComplete = state === "result" || !!output || !isStreaming || i < parts.length - 1;
            return <ToolStatus key={i} input={input} isComplete={isComplete} />;
          }

          return null;
        })}
        {showThinking && (
          <div className="my-1.5 flex items-center gap-2 text-xs text-[#6B6B6B]">
            <div className="animate-spin h-3 w-3 border border-[#D97706] border-t-transparent rounded-full" />
            Thinking...
          </div>
        )}
        {!isStreaming && meta?.usage && (
          <UsageBadge usage={meta.usage} model={meta.model} />
        )}
      </div>
    </div>
  );
}
