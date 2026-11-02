"use client";

import { useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ArrowLeft,
  LifeBuoy,
  MessageCircle,
  Package,
  Phone,
  RotateCw,
  SendHorizontal,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { storageUrl } from "@/features/ordering/images";
import { Link } from "@/i18n/navigation";
import { publicEnv } from "@/lib/env";
import { formatTime, TIME_ZONE } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { telHref, whatsappHref } from "@/lib/contact";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendChatMessage } from "../actions";
import { chatErrorKey } from "../errors";
import {
  chatMessageSchema,
  conversationDetailSchema,
  SYSTEM_CODES,
  type ChatMessage,
  type ChatSide,
  type ConversationDetail,
} from "../schemas";

type Local = ChatMessage & { state?: "sending" | "failed" };

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

function useDayLabel() {
  const t = useTranslations("chat");
  const format = useFormatter();
  return (iso: string) => {
    const key = dayKey.format(new Date(iso));
    const today = dayKey.format(new Date());
    const yesterday = dayKey.format(new Date(Date.now() - 86_400_000));
    if (key === today) return t("today");
    if (key === yesterday) return t("yesterday");
    return format.dateTime(new Date(iso), { day: "numeric", month: "short", timeZone: TIME_ZONE });
  };
}

/**
 * One conversation, live. New messages arrive over Realtime; sending is optimistic (shown at
 * once, marked if it fails, with retry). Opening the thread marks it read.
 */
export function ChatThread({
  initial,
  backHref,
  quickReplies,
  orderBasePath,
  as,
}: {
  initial: ConversationDetail;
  backHref: string;
  quickReplies: string[];
  /** Where an order mentioned in the chat opens for this reader, e.g. /dukan/orders. */
  orderBasePath: string | null;
  /** Staff answering support speak as TezDukan. */
  as?: ChatSide;
}) {
  const t = useTranslations("chat");
  const dayLabel = useDayLabel();
  const queryClient = useQueryClient();
  const { conversation } = initial;
  const mySide = conversation.my_side;
  const [messages, setMessages] = useState<Local[]>(initial.messages);
  const [hasMore, setHasMore] = useState(initial.has_more);
  const [draft, setDraft] = useState("");
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickToEnd = useRef(true);

  const isSupport = conversation.kind === "support" && mySide !== "staff";
  const phone = isSupport
    ? (publicEnv.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? null)
    : conversation.counterpart.phone;
  const whatsapp = isSupport
    ? (publicEnv.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? null)
    : conversation.counterpart.whatsapp;
  const tel = isSupport ? null : telHref(phone);
  const wa = whatsappHref(whatsapp);

  const markRead = useCallback(() => {
    void getSupabaseBrowserClient()
      .rpc("mark_conversation_read", { p_conversation_id: conversation.id })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["chat"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      });
  }, [conversation.id, queryClient]);

  useEffect(() => {
    markRead();
  }, [markRead]);

  // Live: messages from the other side (and our own, from another device).
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`chat:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (event) => {
          const parsed = chatMessageSchema.safeParse(event.new);
          if (!parsed.success) return;
          const message = parsed.data;
          setMessages((current) =>
            current.some((m) => m.id === message.id) ? current : [...current, message],
          );
          if (message.sender_side !== mySide) {
            haptic("tap");
            if (document.visibilityState === "visible") markRead();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation.id, mySide, markRead]);

  // Follow the conversation down unless the reader scrolled up to read older messages.
  useEffect(() => {
    const onScroll = () => {
      const fromEnd = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      stickToEnd.current = fromEnd < 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useLayoutEffect(() => {
    if (stickToEnd.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async (body: string, retryOf?: string) => {
    const text = body.trim();
    if (!text) return;
    const tempId = retryOf ?? `local-${crypto.randomUUID()}`;
    const pending: Local = {
      id: tempId,
      conversation_id: conversation.id,
      sender_id: null,
      sender_side: mySide,
      sender_name: null,
      body: text,
      order_id: null,
      created_at: new Date().toISOString(),
      state: "sending",
    };
    stickToEnd.current = true;
    setMessages((current) =>
      retryOf ? current.map((m) => (m.id === retryOf ? pending : m)) : [...current, pending],
    );
    haptic("tap");
    const result = await sendChatMessage({ conversationId: conversation.id, body: text, as }).catch(
      (error: unknown) => ({ ok: false as const, error: chatErrorKey(error) }),
    );
    setMessages((current) => {
      if (!result.ok) return current.map((m) => (m.id === tempId ? { ...m, state: "failed" } : m));
      const withoutTemp = current.filter((m) => m.id !== tempId);
      return withoutTemp.some((m) => m.id === result.data.id)
        ? withoutTemp
        : [...withoutTemp, result.data];
    });
    if (!result.ok) haptic("warning");
  };

  const loadEarlier = async () => {
    const oldest = messages.find((m) => !m.state);
    if (!oldest) return;
    setLoadingEarlier(true);
    stickToEnd.current = false;
    const { data, error } = await getSupabaseBrowserClient().rpc("conversation_detail", {
      p_conversation_id: conversation.id,
      p_before: oldest.created_at,
      p_as: as,
    });
    setLoadingEarlier(false);
    if (error) return;
    const page = conversationDetailSchema.parse(data);
    setHasMore(page.has_more);
    setMessages((current) => [
      ...page.messages.filter((m) => !current.some((c) => c.id === m.id)),
      ...current,
    ]);
  };

  const submit = () => {
    const text = draft;
    setDraft("");
    void send(text);
    textareaRef.current?.focus();
  };

  return (
    // Fills the screen between the app header and the nav dock, like a messaging app: the
    // composer sits at the bottom and new messages gather just above it.
    <div className="mx-auto flex min-h-[calc(100dvh-4rem-var(--bottom-nav-space)-24px)] w-full max-w-2xl flex-col lg:min-h-[calc(100dvh-6.5rem)]">
      <header className="material sticky top-16 z-20 flex items-center gap-3 border-b border-border/70 px-4 py-3">
        <Link
          href={backHref}
          aria-label={t("back")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-card"
        >
          <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
        </Link>
        <Avatar className="size-11">
          {conversation.counterpart.image_path && !isSupport ? (
            <AvatarImage
              src={storageUrl(conversation.counterpart.image_path, "shop-media") ?? undefined}
              alt=""
            />
          ) : null}
          <AvatarFallback
            name={isSupport ? t("support") : conversation.counterpart.name}
            className={isSupport ? "bg-action text-on-action" : undefined}
          />
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-lg font-bold text-ink">
            {isSupport ? t("support") : conversation.counterpart.name}
          </h1>
          {isSupport ? (
            <p className="truncate text-xs text-muted">{t("supportReplyTime")}</p>
          ) : null}
        </div>
        {tel ? (
          <a
            href={tel}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"
          >
            <Phone aria-hidden className="size-5" />
            <span className="sr-only">{t("call")}</span>
          </a>
        ) : null}
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"
          >
            <MessageCircle aria-hidden className="size-5" />
            <span className="sr-only">{t("whatsapp")}</span>
          </a>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col justify-end gap-1 px-4 py-4">
        {hasMore ? (
          <Button
            variant="ghost"
            size="sm"
            className="mx-auto mb-2"
            loading={loadingEarlier}
            onClick={() => void loadEarlier()}
          >
            {t("earlier")}
          </Button>
        ) : null}
        {messages.length === 0 ? (
          <p className="mx-auto my-10 max-w-64 text-center text-muted">{t("noMessages")}</p>
        ) : null}
        <div role="log" aria-label={t("open")}>
          <ol className="flex flex-col gap-1">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const newDay =
                !previous ||
                dayKey.format(new Date(previous.created_at)) !==
                  dayKey.format(new Date(message.created_at));
              const mine = message.sender_side === mySide;
              const system = message.sender_side === "system";
              const code = SYSTEM_CODES[message.body as keyof typeof SYSTEM_CODES];
              return (
                <li key={message.id} className="flex flex-col">
                  {newDay ? (
                    <span className="my-3 self-center rounded-full bg-subtle px-3 py-1 text-xs font-semibold text-muted">
                      {dayLabel(message.created_at)}
                    </span>
                  ) : null}
                  {system ? (
                    <p className="my-2 flex items-start gap-2 self-center rounded-lg bg-awning-soft px-3 py-2 text-sm text-ink">
                      <LifeBuoy aria-hidden className="mt-0.5 size-4 shrink-0 text-awning-ink" />
                      {code ? t(code) : message.body}
                    </p>
                  ) : (
                    <div
                      className={cn(
                        "flex max-w-[82%] flex-col gap-1 px-3.5 py-2 text-[15px] leading-snug shadow-card",
                        mine
                          ? "ms-auto rounded-2xl rounded-ee-md bg-action text-on-action"
                          : "me-auto rounded-2xl rounded-es-md border border-border/70 bg-surface text-ink",
                        message.state === "failed" && "opacity-70",
                      )}
                    >
                      {message.order_id && message.order_number && orderBasePath ? (
                        <Link
                          href={`${orderBasePath}/${message.order_id}`}
                          className={cn(
                            "num flex items-center gap-1.5 text-xs font-semibold underline-offset-2 hover:underline",
                            mine ? "text-on-action/90" : "text-primary-strong",
                          )}
                        >
                          <Package aria-hidden className="size-3.5" />
                          {t("aboutOrder", { number: message.order_number })}
                        </Link>
                      ) : null}
                      <p className="break-words whitespace-pre-wrap">{message.body}</p>
                      <span
                        className={cn(
                          "num self-end text-[11px]",
                          mine ? "text-on-action/75" : "text-muted",
                        )}
                      >
                        {message.state === "sending"
                          ? t("sending")
                          : `⁦${formatTime(message.created_at)}⁩`}
                      </span>
                    </div>
                  )}
                  {message.state === "failed" ? (
                    <button
                      type="button"
                      onClick={() => void send(message.body, message.id)}
                      className="ms-auto mt-1 flex items-center gap-1 text-xs font-semibold text-danger-ink"
                    >
                      <RotateCw aria-hidden className="size-3.5" />
                      {t("failed")}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
        <div ref={endRef} />
      </div>

      <div className="material sticky bottom-[calc(var(--bottom-nav-space)+10px)] z-20 mx-3 mb-3 flex flex-col gap-2 rounded-2xl p-2 shadow-float lg:bottom-6">
        <div className="-mx-1 flex [scrollbar-width:none] gap-2 overflow-x-auto px-1 pb-0.5">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => void send(reply)}
              className="relative h-9 shrink-0 rounded-full border border-border bg-surface px-3.5 text-sm font-semibold whitespace-nowrap text-ink after:absolute after:inset-x-0 after:-inset-y-1"
            >
              {reply}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label htmlFor="chat-message" className="sr-only">
            {t("placeholder")}
          </label>
          <textarea
            id="chat-message"
            ref={textareaRef}
            value={draft}
            rows={1}
            maxLength={2000}
            placeholder={t("placeholder")}
            onChange={(event) => {
              setDraft(event.target.value);
              const el = event.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            className="max-h-36 min-h-12 flex-1 resize-none rounded-xl border border-border bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring"
          />
          <Button type="submit" size="icon" disabled={!draft.trim()} className="rounded-full">
            <SendHorizontal aria-hidden className="rtl:-scale-x-100" />
            <span className="sr-only">{t("send")}</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
