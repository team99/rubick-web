"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import type { UIMessage } from "ai";

function ESQueryBlock({
  input,
  output,
  isComplete,
}: {
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  isComplete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const index = String(input?.index || "unknown");
  const query = input?.query as Record<string, unknown> | undefined;

  if (!isComplete) {
    return (
      <div className="my-2 flex items-center gap-2 text-sm text-[#6B6B6B]">
        <div className="animate-spin h-3 w-3 border border-[#D97706] border-t-transparent rounded-full" />
        Querying {index}...
      </div>
    );
  }

  return (
    <div className="my-2 rounded-lg border border-[#E5E3DC] dark:border-[#333333] overflow-hidden text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[#F5F5F0] dark:bg-[#262626] hover:bg-[#EDEBE5] dark:hover:bg-[#2A2A2A] transition-colors text-left"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={`transition-transform ${open ? "rotate-90" : ""} text-[#6B6B6B]`}
          fill="currentColor"
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
        <span className="font-medium text-[#D97706]">ES Query</span>
        <span className="text-[#6B6B6B] dark:text-[#999999]">{index}</span>
      </button>
      {open && (
        <div className="px-3 py-2 space-y-2 bg-[#F5F2EB] dark:bg-[#1E1E1E]">
          {query && (
            <div>
              <span className="text-[#6B6B6B] font-medium">Query:</span>
              <pre className="mt-1 overflow-x-auto text-[#1A1A1A] dark:text-[#E8E8E8]">
                {JSON.stringify(query, null, 2)}
              </pre>
            </div>
          )}
          {output && (
            <div>
              <span className="text-[#6B6B6B] font-medium">Result:</span>
              <pre className="mt-1 overflow-x-auto max-h-60 text-[#1A1A1A] dark:text-[#E8E8E8]">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
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
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { role, parts } = message;

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

          // Handle tool call parts (v6: type is "tool-{name}" or "dynamic-tool")
          if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
            const { input, output, state } = getToolInfo(part);
            const isComplete = state === "result";

            return (
              <ESQueryBlock
                key={i}
                input={input}
                output={output}
                isComplete={isComplete}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
