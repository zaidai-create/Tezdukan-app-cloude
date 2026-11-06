"use client";

import { useEffect, useRef, useState } from "react";
import type { Message, ProjectStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/cn";

export function Chat({
  messages, status, onSend, busy,
}: {
  messages: Message[];
  status: ProjectStatus;
  onSend: (content: string) => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, busy]);

  const disabled = busy ||
    status === "PROCESSING" || status === "QUALITY_CHECK" ||
    status === "COMPLETED"  || status === "CANCELLED";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || disabled) return;
    onSend(content);
    setText("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-5 py-3">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">Assistant</div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-4 py-4">
        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "animate-fade-in max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                m.role === "assistant"
                  ? "bg-surface-panel text-ink"
                  : "ml-auto bg-ink text-surface"
              )}
            >
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="max-w-[60%] rounded-2xl bg-surface-panel px-3.5 py-2.5 text-sm text-ink-muted">
              <span className="typing-dot inline-block h-1.5 w-1.5 mx-0.5 rounded-full bg-ink-muted"></span>
              <span className="typing-dot inline-block h-1.5 w-1.5 mx-0.5 rounded-full bg-ink-muted"></span>
              <span className="typing-dot inline-block h-1.5 w-1.5 mx-0.5 rounded-full bg-ink-muted"></span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form onSubmit={submit} className="border-t border-line p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); }
            }}
            placeholder={disabled ? "Chat is paused in this state." : "Describe what you need…"}
            rows={2}
            disabled={disabled}
            className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
          />
          <button
            disabled={disabled || !text.trim()}
            className="rounded-xl bg-ink px-3 py-2 text-xs font-medium text-surface disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
