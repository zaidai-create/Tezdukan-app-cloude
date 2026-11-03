"use client";

import { cn } from "cn";
import { ArrowUp, Mic, Square, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { SpeedLines } from "@/components/brand/speed-lines";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { speechLang } from "@/i18n/locales";
import { usePathname } from "@/i18n/navigation";
import type { AppRole } from "@/lib/auth/roles";
import { useMunshi } from "./munshi-store";

type NewMessage =
  | { from: "user"; text: string }
  | { from: "munshi"; kind: "notice" | "error"; text: string; sandbox?: boolean };
type Message = NewMessage & { id: number };

/** Three role-specific example commands (message keys munshi.suggestions.<role>.s1–s3). */
const suggestionKeys = ["s1", "s2", "s3"] as const;

/**
 * Conversation body. Mounted fresh each time the sheet opens, so the draft (from Ctrl+K) and
 * hold-to-talk start cleanly without syncing state in effects.
 */
function MunshiPanel({
  role,
  draft,
  listenOnOpen,
}: {
  role: AppRole;
  draft: string;
  listenOnOpen: boolean;
}) {
  const t = useTranslations("munshi");
  const locale = useLocale();
  const pathname = usePathname();
  const [input, setInput] = useState(draft);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  const push = (message: NewMessage) =>
    setMessages((list) => [...list, { ...message, id: nextId.current++ }]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    push({ from: "user", text });
    setInput("");
    setSending(true);
    try {
      const response = await fetch("/api/munshi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, locale, screen: pathname }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (body.error === "ai_not_configured") {
        push({ from: "munshi", kind: "notice", text: t("notConfigured"), sandbox: true });
      } else if (!response.ok) {
        push({ from: "munshi", kind: "error", text: t("unavailable") });
      }
    } catch {
      push({ from: "munshi", kind: "error", text: t("offline") });
    } finally {
      setSending(false);
    }
  };

  const speech = useVoiceInput(speechLang[locale], {
    onEnd: (heard) => {
      if (heard) void send(heard);
    },
  });
  const { start: startListening, cancel: cancelListening } = speech;

  // Hold-to-talk opens the sheet already listening; closing the sheet stops the mic.
  useEffect(() => {
    if (listenOnOpen) startListening();
    return cancelListening;
  }, [listenOnOpen, startListening, cancelListening]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const listening = speech.status === "listening";

  return (
    <>
      <SheetBody>
        <div
          ref={listRef}
          className="flex h-full flex-col gap-3 overflow-y-auto"
          aria-live="polite"
        >
          {messages.length === 0 && !listening ? (
            <div className="flex flex-col gap-3 py-2">
              <p className="text-base text-ink">{t("greeting")}</p>
              <p className="text-sm text-muted">{t("tryThese")}</p>
              <div className="flex flex-wrap gap-2">
                {suggestionKeys.map((key) => (
                  <FilterChip key={key} onClick={() => void send(t(`suggestions.${role}.${key}`))}>
                    {t(`suggestions.${role}.${key}`)}
                  </FilterChip>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) =>
            message.from === "user" ? (
              <p
                key={message.id}
                className="max-w-[85%] self-end rounded-lg rounded-ee-sm bg-action px-3.5 py-2.5 text-base text-on-action"
              >
                {message.text}
              </p>
            ) : (
              <div
                key={message.id}
                className={cn(
                  "flex max-w-[90%] flex-col gap-1.5 self-start rounded-lg rounded-es-sm px-3.5 py-2.5 text-sm",
                  message.kind === "error"
                    ? "bg-danger-soft text-danger-ink"
                    : "bg-subtle text-ink",
                )}
              >
                {message.sandbox ? (
                  <Badge variant="offer" size="sm">
                    {t("sandbox")}
                  </Badge>
                ) : null}
                <p>{message.text}</p>
              </div>
            ),
          )}

          {sending ? (
            <div className="flex items-center gap-2 self-start rounded-lg bg-subtle px-3.5 py-3 text-sm text-muted">
              <SpeedLines animated className="w-7" />
              {t("thinking")}
            </div>
          ) : null}

          {listening ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <SpeedLines animated className="w-16" />
              <p className="text-sm font-semibold text-primary-strong">{t("listening")}</p>
              <p className="min-h-7 text-lg text-ink">{speech.transcript || t("speakNow")}</p>
            </div>
          ) : null}
          {speech.status === "working" ? (
            <div className="flex items-center gap-2 self-center rounded-lg bg-subtle px-3.5 py-3 text-sm text-muted">
              <SpeedLines animated className="w-7" />
              {t("transcribing")}
            </div>
          ) : null}
          {speech.status === "denied" ? (
            <p className="rounded-md bg-awning-soft px-3 py-2 text-sm text-awning-ink">
              {t("micDenied")}
            </p>
          ) : null}
        </div>
      </SheetBody>

      <SheetFooter className="flex-col gap-2">
        {listening ? (
          <div className="flex w-full gap-2">
            <Button variant="secondary" className="flex-1" onClick={speech.cancel}>
              <X aria-hidden />
              {t("cancel")}
            </Button>
            <Button className="flex-1" onClick={speech.stop}>
              <Square aria-hidden className="size-4 fill-current" />
              {t("done")}
            </Button>
          </div>
        ) : (
          <form
            className="flex w-full items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <label className="sr-only" htmlFor="munshi-input">
              {t("inputLabel")}
            </label>
            <textarea
              id="munshi-input"
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              placeholder={t("placeholder")}
              className="field-sizing-content max-h-32 min-h-12 flex-1 resize-none rounded-md border border-border-strong bg-surface px-3.5 py-3 text-base text-ink outline-none placeholder:text-muted focus-visible:border-primary-strong focus-visible:ring-3 focus-visible:ring-primary/20"
            />
            {speech.supported && !input.trim() ? (
              <Button type="button" size="icon" aria-label={t("talk")} onClick={speech.start}>
                <Mic aria-hidden />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                aria-label={t("send")}
                disabled={!input.trim() || sending}
              >
                <ArrowUp aria-hidden />
              </Button>
            )}
          </form>
        )}
      </SheetFooter>
    </>
  );
}

/**
 * Munshi: talk or type. Voice uses the browser recogniser (ur-PK / en-PK) with a live
 * transcript; the speed lines show while listening and thinking. Requests go to
 * /api/munshi under the user's own session.
 */
function MunshiSheet({ role }: { role: AppRole }) {
  const t = useTranslations("munshi");
  const { open, setOpen, listenOnOpen, draft } = useMunshi();
  const desktop = useMediaQuery("(min-width: 1024px)");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side={desktop ? "end" : "bottom"}
        className={cn(desktop ? "" : "h-[78dvh]")}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="flex-row items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint-soft text-primary-strong">
            <Mic aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <SheetTitle>{t("title")}</SheetTitle>
            <SheetDescription>{t("subtitle")}</SheetDescription>
          </div>
        </SheetHeader>
        <MunshiPanel role={role} draft={draft} listenOnOpen={listenOnOpen} />
      </SheetContent>
    </Sheet>
  );
}

export { MunshiSheet };
