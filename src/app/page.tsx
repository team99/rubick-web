"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ModelSelector } from "@/components/model-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Welcome } from "@/components/chat/welcome";
import { DEFAULT_MODEL } from "@/lib/models";

export default function ChatPage() {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const router = useRouter();

  // Load persisted model on mount
  useEffect(() => {
    const stored = localStorage.getItem("rubick-model");
    if (stored) setModel(stored);
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { model },
      }),
    [model]
  );

  const { messages, sendMessage, stop, setMessages, status } = useChat({
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Track if user has scrolled up
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUp.current = distanceFromBottom > 100;
  }, []);

  // Auto-scroll only if user hasn't scrolled up
  useEffect(() => {
    if (scrollRef.current && !isUserScrolledUp.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleModelChange(newModel: string) {
    setModel(newModel);
    localStorage.setItem("rubick-model", newModel);
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } finally {
      window.location.href = "/login";
    }
  }

  function handleNewChat() {
    setMessages([]);
    setInput("");
  }

  // M1: Example chips auto-submit
  async function handleExampleSelect(question: string) {
    setInput("");
    await sendMessage({ text: question });
  }

  async function onSubmit() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-[#E5E3DC] dark:border-[#333333] bg-[#FAFAF8] dark:bg-[#1A1A1A]">
        <div className="flex items-center gap-3">
          <button
            onClick={handleNewChat}
            className="text-base font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] hover:opacity-70 transition-opacity"
          >
            Rubick
          </button>
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="text-xs px-2 py-1 rounded-md border border-[#E5E3DC] dark:border-[#333333] text-[#6B6B6B] hover:bg-[#F0EDE8] dark:hover:bg-[#333333] transition-colors"
            >
              New chat
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ModelSelector value={model} onChange={handleModelChange} />
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1.5 rounded-lg text-[#6B6B6B] hover:bg-[#F0EDE8] dark:hover:bg-[#333333] transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Chat area */}
      {messages.length === 0 ? (
        <Welcome onSelect={handleExampleSelect} />
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading &&
              messages.length > 0 &&
              messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 text-sm text-[#6B6B6B]">
                    <div className="animate-spin h-3 w-3 border border-[#D97706] border-t-transparent rounded-full" />
                    Thinking...
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={onSubmit}
        isLoading={isLoading}
        onStop={stop}
      />
    </div>
  );
}
