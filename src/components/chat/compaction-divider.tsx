"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function CompactionDivider({ summary }: { summary: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-6">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#E5E3DC] dark:bg-[#333333]" />
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A] dark:hover:text-[#E8E8E8] transition-colors"
        >
          {open ? "Hide" : "View"} earlier context summary
        </button>
        <div className="flex-1 h-px bg-[#E5E3DC] dark:bg-[#333333]" />
      </div>
      {open && (
        <div className="mt-4 p-4 rounded-lg bg-[#F0EDE8] dark:bg-[#1F1F1F] text-sm text-[#1A1A1A] dark:text-[#E8E8E8] prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
