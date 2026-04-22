"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ModelSelector } from "@/components/model-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Sidebar } from "@/components/chat/sidebar";
import { CompactionDivider } from "@/components/chat/compaction-divider";
import { DEFAULT_MODEL } from "@/lib/models";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const router = useRouter();

  const [model, setModel] = useState(DEFAULT_MODEL);
  const [modelsReady, setModelsReady] = useState(false);
  const [input, setInput] = useState("");
  const [initialMessages, setInitialMessages] = useState<unknown[] | null>(null);
  const [earlierSummary, setEarlierSummary] = useState<string | null>(null);
  const [title, setTitle] = useState("New chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  // Load history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) {
        router.push("/");
        return;
      }
      const body = await res.json();
      if (cancelled) return;
      setInitialMessages(body.messages);
      setEarlierSummary(body.earlierSummary ?? null);
      setTitle(body.conversation.title);
      setModel(body.conversation.model);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, router]);

  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  const transport = useMemo(
    () =>
      // `body` runs at send time (not during render), so ref access is safe.
      // eslint-disable-next-line react-hooks/refs
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          conversationId,
          model: modelRef.current,
        }),
        prepareSendMessagesRequest({ messages, body }) {
          const last = messages[messages.length - 1];
          const text =
            last?.parts
              ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("") ?? "";
          return { body: { ...body, message: text } };
        },
      }),
    [conversationId]
  );

  const { messages, sendMessage, stop, status, error, setMessages } = useChat({
    transport,
  });

  useEffect(() => {
    if (initialMessages) setMessages(initialMessages as Parameters<typeof setMessages>[0]);
  }, [initialMessages, setMessages]);

  // Auto-send first message if handed off from /
  useEffect(() => {
    if (!modelsReady || !initialMessages) return;
    const key = `rubick-first-message:${conversationId}`;
    const pending = sessionStorage.getItem(key);
    if (pending && initialMessages.length === 0) {
      sessionStorage.removeItem(key);
      sendMessage({ text: pending });
    }
  }, [modelsReady, initialMessages, conversationId, sendMessage]);

  const isLoading = status === "streaming" || status === "submitted";

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUp.current = distanceFromBottom > 100;
  }, []);

  useEffect(() => {
    if (scrollRef.current && !isUserScrolledUp.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function onSubmit() {
    if (!modelsReady) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="h-full flex">
      <Sidebar activeId={conversationId} />
      <div className="flex-1 flex flex-col">
        <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-[#E5E3DC] dark:border-[#333333] bg-[#FAFAF8] dark:bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-base font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] hover:opacity-70 transition-opacity"
            >
              Rubick
            </button>
            <span className="text-sm text-[#6B6B6B] truncate max-w-[320px]">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Model is frozen per-conversation; selector is read-only here. */}
            <ModelSelector value={model} onChange={() => {}} disabled onModelsLoaded={() => setModelsReady(true)} />
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

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {earlierSummary && <CompactionDivider summary={earlierSummary} />}
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isLoading && idx === messages.length - 1}
              />
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
            {error && (
              <div className="flex justify-start">
                <div className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400">
                  {error.message || "Something went wrong"}
                </div>
              </div>
            )}
          </div>
        </div>

        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={onSubmit}
          isLoading={isLoading}
          onStop={stop}
        />
      </div>
    </div>
  );
}
