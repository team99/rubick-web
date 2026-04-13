"use client";

const EXAMPLES = [
  "Top 10 agents with most enquiries this month",
  "How many active house listings are in Jakarta?",
  "WhatsApp vs phone enquiry breakdown last 30 days",
  "Which districts have the highest repost activity?",
];

interface WelcomeProps {
  onSelect: (question: string) => void;
}

export function Welcome({ onSelect }: WelcomeProps) {
  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="max-w-lg text-center">
        <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          Rubick
        </h2>
        <p className="text-[#6B6B6B] dark:text-[#999999] mb-8">
          Ask anything about Rumah123 &amp; iProperty data
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EXAMPLES.map((q) => (
            <button
              key={q}
              onClick={() => onSelect(q)}
              className="text-left px-4 py-3 rounded-xl border border-[#E5E3DC] dark:border-[#333333] bg-white dark:bg-[#262626] text-sm text-[#1A1A1A] dark:text-[#E8E8E8] hover:bg-[#F0EDE8] dark:hover:bg-[#333333] transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
