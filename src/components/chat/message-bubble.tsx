"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UIMessage } from "ai";

const mdComponents: Components = {
  table: ({ children }) => (
    <table className="w-full text-sm border-separate border-spacing-0 rounded-lg overflow-hidden border border-[#E5E3DC] dark:border-[#333333] my-3">
      {children}
    </table>
  ),
  thead: ({ children }) => (
    <thead className="bg-[#F5F2EB] dark:bg-[#D97706]/15">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left font-semibold text-[#1A1A1A] dark:text-[#D97706] px-4 py-2.5 border-b border-[#E5E3DC] dark:border-[#D97706]/20">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 border-b border-[#F0EDE8] dark:border-[#2A2A2A] text-[#1A1A1A] dark:text-[#E8E8E8]">
      {children}
    </td>
  ),
  tr: ({ children, ...props }) => {
    // @ts-expect-error -- node not typed
    const isHead = props.node?.parentNode?.tagName === "thead";
    return <tr className={isHead ? "" : "hover:bg-[#F5F2EB]/50 dark:hover:bg-[#262626]/50 even:bg-[#FAFAF8] dark:even:bg-[#1E1E1E] [&:last-child_td]:border-b-0"}>{children}</tr>;
  },
  p: ({ children }) => (
    <p className="text-[#1A1A1A] dark:text-[#E8E8E8] my-2">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">{children}</strong>
  ),
  h1: ({ children }) => <h1 className="text-xl font-bold text-[#1A1A1A] dark:text-[#E8E8E8] mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-[#E8E8E8] mt-4 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#E8E8E8] mt-3 mb-1">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-2 text-[#1A1A1A] dark:text-[#E8E8E8]">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-2 text-[#1A1A1A] dark:text-[#E8E8E8]">{children}</ol>,
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return <code className={`${className} block`}>{children}</code>;
    }
    return <code className="bg-[#F5F2EB] dark:bg-[#262626] px-1 py-0.5 rounded text-sm">{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="bg-[#F5F2EB] dark:bg-[#1E1E1E] border border-[#E5E3DC] dark:border-[#333333] rounded-lg p-3 overflow-x-auto my-3 text-sm">
      {children}
    </pre>
  ),
};


function ToolStatus({ toolType, input, isComplete }: { toolType: string; input: Record<string, unknown>; isComplete: boolean }) {
  let label: string;
  if (toolType === "get_schema") {
    const indices = (input?.indices as string[]) || [];
    const names = indices.join(", ") || "schemas";
    label = isComplete ? `Loaded ${names}` : `Loading ${names}...`;
  } else {
    const index = String(input?.index || "unknown");
    label = isComplete ? `Queried ${index}` : `Querying ${index}...`;
  }

  return (
    <div className="my-1.5 flex items-center gap-2 text-xs text-[#6B6B6B]">
      {isComplete ? (
        <svg width="12" height="12" viewBox="0 0 12 12" className="text-[#D97706] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2.5 6.5L5 9L9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <div className="animate-spin h-3 w-3 border border-[#D97706] border-t-transparent rounded-full shrink-0" />
      )}
      <span>{label}</span>
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
              <div key={i}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={mdComponents}
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
            const toolType = part.type.startsWith("tool-") ? part.type.slice(5) : "unknown";
            return <ToolStatus key={i} toolType={toolType} input={input} isComplete={isComplete} />;
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
