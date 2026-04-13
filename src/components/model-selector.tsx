"use client";

import { MODELS } from "@/lib/models";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-[#D97706]/10 text-[#D97706]",
  openai: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  google: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const selected = MODELS.find((m) => m.id === value) || MODELS[0];

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-[#E5E3DC] dark:border-[#333333] bg-white dark:bg-[#262626] text-sm text-[#1A1A1A] dark:text-[#E8E8E8] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D97706]/40"
      >
        {MODELS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="text-[#6B6B6B]"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span
        className={`absolute -top-1 -right-1 text-[9px] px-1 rounded font-medium ${PROVIDER_COLORS[selected.provider]}`}
      >
        {selected.provider === "anthropic"
          ? "Claude"
          : selected.provider === "openai"
          ? "OpenAI"
          : "Google"}
      </span>
    </div>
  );
}
