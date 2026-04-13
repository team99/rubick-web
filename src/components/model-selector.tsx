"use client";

import { useEffect, useState } from "react";

interface AvailableModel {
  id: string;
  name: string;
  provider: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  google: "Google",
};

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
  const [models, setModels] = useState<AvailableModel[]>([]);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: AvailableModel[]) => {
        setModels(data);
        // If current model isn't available, switch to first available
        if (data.length > 0 && !data.some((m) => m.id === value)) {
          onChange(data[0].id);
        }
      })
      .catch(() => {
        // Fallback — show nothing, user can still type
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = models.find((m) => m.id === value) || models[0];

  if (models.length === 0) {
    return (
      <span className="text-xs text-[#6B6B6B] px-2">Loading models...</span>
    );
  }

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-[#E5E3DC] dark:border-[#333333] bg-white dark:bg-[#262626] text-sm text-[#1A1A1A] dark:text-[#E8E8E8] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D97706]/40"
      >
        {models.map((model) => (
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
      {selected && (
        <span
          className={`absolute -top-1 -right-1 text-[9px] px-1 rounded font-medium ${PROVIDER_COLORS[selected.provider] || ""}`}
        >
          {PROVIDER_LABELS[selected.provider] || selected.provider}
        </span>
      )}
    </div>
  );
}
