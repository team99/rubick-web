"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Conv = { id: string; title: string; model: string; updated_at: string };

export function Sidebar({ activeId }: { activeId: string | null }) {
  const [items, setItems] = useState<Conv[]>([]);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => setItems([]));
  }, [activeId]);

  return (
    <aside className="w-60 shrink-0 border-r border-[#E5E3DC] dark:border-[#333333] bg-[#FAFAF8] dark:bg-[#1A1A1A] flex flex-col">
      <div className="p-3">
        <Link
          href="/"
          className="block text-sm px-3 py-2 rounded-lg border border-[#E5E3DC] dark:border-[#333333] text-[#1A1A1A] dark:text-[#E8E8E8] hover:bg-[#F0EDE8] dark:hover:bg-[#333333] transition-colors text-center"
        >
          + New chat
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {items.map((c) => (
          <Link
            key={c.id}
            href={`/c/${c.id}`}
            className={`block text-sm px-3 py-2 rounded-md truncate transition-colors ${
              c.id === activeId
                ? "bg-[#F0EDE8] dark:bg-[#333333] text-[#1A1A1A] dark:text-[#E8E8E8]"
                : "text-[#6B6B6B] hover:bg-[#F0EDE8]/60 dark:hover:bg-[#333333]/60"
            }`}
          >
            {c.title}
          </Link>
        ))}
        {items.length === 0 && (
          <div className="px-3 py-2 text-xs text-[#6B6B6B]">No conversations yet.</div>
        )}
      </div>
    </aside>
  );
}
