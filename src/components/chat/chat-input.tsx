"use client";

import { useRef, useEffect } from "react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onStop: () => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  onStop,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) {
        onSubmit();
      }
    }
  }

  return (
    <div className="border-t border-[#E5E3DC] dark:border-[#333333] bg-[#FAFAF8] dark:bg-[#1A1A1A]">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-end gap-2 rounded-2xl border border-[#E5E3DC] dark:border-[#333333] bg-white dark:bg-[#262626] px-4 py-3 focus-within:ring-2 focus-within:ring-[#D97706]/40 focus-within:border-[#D97706]/40 transition-shadow">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-[15px] text-[#1A1A1A] dark:text-[#E8E8E8] placeholder-[#6B6B6B] dark:placeholder-[#666666] focus:outline-none leading-relaxed"
          />
          {isLoading ? (
            <button
              onClick={onStop}
              className="shrink-0 p-1.5 rounded-lg bg-[#1A1A1A] dark:bg-[#E8E8E8] text-white dark:text-[#1A1A1A] hover:opacity-80 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="4" y="4" width="8" height="8" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={!value.trim()}
              className="shrink-0 p-1.5 rounded-lg bg-[#1A1A1A] dark:bg-[#E8E8E8] text-white dark:text-[#1A1A1A] hover:opacity-80 disabled:opacity-30 transition-opacity"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.5 13V3l10 5-10 5z" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-center text-[11px] text-[#999999] mt-2">
          Rubick queries Rumah123 Elasticsearch data. Results may not be real-time.
        </p>
      </div>
    </div>
  );
}
