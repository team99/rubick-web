"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ModelSelector } from "@/components/model-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatInput } from "@/components/chat/chat-input";
import { Welcome } from "@/components/chat/welcome";
import { Sidebar } from "@/components/chat/sidebar";
import { DEFAULT_MODEL } from "@/lib/models";

export default function NewChatPage() {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [modelsReady, setModelsReady] = useState(false);
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("rubick-model");
    if (stored) setModel(stored);
  }, []);

  function handleModelChange(newModel: string) {
    setModel(newModel);
    localStorage.setItem("rubick-model", newModel);
  }

  async function startConversation(text: string) {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      const { id } = await res.json();
      // Stash the first message so /c/[id] can send it immediately
      sessionStorage.setItem(`rubick-first-message:${id}`, text);
      router.push(`/c/${id}`);
    } catch (err) {
      setCreating(false);
      alert(err instanceof Error ? err.message : "Failed to start chat");
    }
  }

  async function onSubmit() {
    if (!modelsReady) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    await startConversation(text);
  }

  async function handleExampleSelect(question: string) {
    if (!modelsReady) return;
    await startConversation(question);
  }

  return (
    <div className="h-full flex">
      <Sidebar activeId={null} />
      <div className="flex-1 flex flex-col">
        <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-[#E5E3DC] dark:border-[#333333] bg-[#FAFAF8] dark:bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              Rubick
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector value={model} onChange={handleModelChange} onModelsLoaded={() => setModelsReady(true)} />
            <ThemeToggle />
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="text-xs px-3 py-1.5 rounded-lg text-[#6B6B6B] hover:bg-[#F0EDE8] dark:hover:bg-[#333333] transition-colors"
              >
                Logout
              </button>
            </form>
          </div>
        </header>

        <Welcome onSelect={handleExampleSelect} />

        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={onSubmit}
          isLoading={creating}
          onStop={() => {}}
        />
      </div>
    </div>
  );
}
