"use client";

import { cn } from "cn";
import {
  ArrowUp,
  ArrowUpRight,
  Banknote,
  BellOff,
  Check,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  type LucideIcon,
  MapPin,
  Mic,
  NotebookText,
  PackageMinus,
  PackageSearch,
  Route,
  ShieldCheck,
  ShoppingBasket,
  Store,
  TrendingUp,
  Truck,
  Volume2,
  Wallet,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { SpeedLines } from "@/components/brand/speed-lines";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCustomerCart } from "@/features/storefront/cart-store";
import { storefrontProductSchema } from "@/features/storefront/schemas";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { speechLang } from "@/i18n/locales";
import { Link, usePathname } from "@/i18n/navigation";
import type { AppRole } from "@/lib/auth/roles";
import { haptic } from "@/lib/haptics";
import { useMunshi } from "./munshi-store";

type NewMessage =
  | { from: "user"; text: string }
  | { from: "munshi"; kind: "notice" | "error"; text: string; sandbox?: boolean }
  | { from: "munshi"; kind: "reply"; text: string; link: { href: string; label: string } | null };

const replySchema = z.object({
  reply: z.string(),
  link: z.object({ href: z.string().startsWith("/"), label: z.string() }).nullable(),
  // Products Tez put in a shopper's cart; added here because the cart lives on the phone.
  cart: z
    .array(
      z.object({ product: storefrontProductSchema, quantity: z.number().int().min(1).max(20) }),
    )
    .catch([]),
});

/** Reads a reply aloud for people who read slowly (the phone's own voice, no network). */
function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}
type Message = NewMessage & { id: number };

/**
 * Three example requests per role (message keys munshi.suggestions.<role>.s1–s3), each with
 * an icon so the row can be recognised without reading it.
 */
const suggestions = [
  {
    key: "s1",
    icons: {
      customer: Store,
      dukandar: Banknote,
      distributor: ClipboardList,
      booker: Route,
      rider: MapPin,
      admin: ShieldCheck,
    },
  },
  {
    key: "s2",
    icons: {
      customer: PackageSearch,
      dukandar: PackageMinus,
      distributor: BellOff,
      booker: Wallet,
      rider: Banknote,
      admin: TrendingUp,
    },
  },
  {
    key: "s3",
    icons: {
      customer: ShoppingBasket,
      dukandar: NotebookText,
      distributor: TrendingUp,
      booker: FilePlus2,
      rider: Route,
      admin: Truck,
    },
  },
] as const satisfies readonly { key: string; icons: Record<AppRole, LucideIcon> }[];

/** How long the mic has been open, as 0:07. Mounted only while listening, so it starts at 0. */
function ListeningClock() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <p className="num text-base font-semibold text-muted" aria-hidden>
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </p>
  );
}

/**
 * The voice screen: a breathing orb with the speed lines in it, what has been heard so far,
 * and two big round buttons. Nothing else competes with it while the mic is open.
 */
function VoiceScreen({
  working,
  transcript,
  onCancel,
  onDone,
}: {
  working: boolean;
  transcript: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("munshi");
  return (
    <div className="flex h-full flex-col items-center justify-between gap-6 pt-4 pb-2 text-center">
      <div className="flex flex-col items-center gap-1" aria-live="polite">
        <p className="font-heading text-2xl font-bold text-ink">
          {working ? t("transcribing") : t("listening")}
        </p>
        {working ? null : <ListeningClock />}
      </div>

      <div className="relative flex size-56 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 animate-breathe rounded-full bg-mint-soft motion-reduce:animate-none"
        />
        <span
          aria-hidden
          className="absolute inset-7 animate-breathe rounded-full bg-mint/35 [animation-delay:300ms] motion-reduce:animate-none"
        />
        <span className="sheen relative flex size-28 items-center justify-center rounded-full bg-action text-on-action shadow-glow inset-shadow-edge">
          <SpeedLines animated tone="on-action" className="w-12" />
        </span>
      </div>

      <p className="min-h-16 max-w-xs text-lg leading-snug text-ink" dir="auto">
        {transcript || (working ? "" : t("speakNow"))}
      </p>

      <div className="flex w-full items-start justify-center gap-12">
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-col items-center gap-1.5 text-sm font-semibold text-ink"
        >
          <span className="flex size-16 items-center justify-center rounded-full border border-border bg-surface shadow-card transition-transform duration-150 ease-out active:scale-95">
            <X aria-hidden className="size-7" strokeWidth={1.75} />
          </span>
          {t("cancel")}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={working}
          className="flex flex-col items-center gap-1.5 text-sm font-semibold text-ink disabled:opacity-60"
        >
          <span className="sheen flex size-16 items-center justify-center rounded-full bg-action text-on-action shadow-glow inset-shadow-edge transition-transform duration-150 ease-out active:scale-95">
            <Check aria-hidden className="size-7" strokeWidth={2.25} />
          </span>
          {t("done")}
        </button>
      </div>
    </div>
  );
}

/**
 * Conversation body. Mounted fresh each time the sheet opens, so the draft (from Ctrl+K) and
 * hold-to-talk start cleanly without syncing state in effects.
 */
function MunshiPanel({
  role,
  name,
  draft,
  listenOnOpen,
}: {
  role: AppRole;
  name: string;
  draft: string;
  listenOnOpen: boolean;
}) {
  const t = useTranslations("munshi");
  const locale = useLocale();
  const pathname = usePathname();
  const { setOpen } = useMunshi();
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
    // The last few turns, so Tez can follow "and the other one?" style follow-ups.
    const history = messages
      .filter((m) => m.from === "user" || m.kind === "reply")
      .slice(-8)
      .map((m) => ({ role: m.from === "user" ? "user" : "munshi", text: m.text }));
    push({ from: "user", text });
    setInput("");
    setSending(true);
    try {
      const response = await fetch("/api/munshi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, locale, screen: pathname, history }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      const error = z.object({ error: z.string() }).safeParse(body);
      const answer = replySchema.safeParse(body);
      if (response.ok && answer.success) {
        const cart = useCustomerCart.getState();
        for (const { product, quantity } of answer.data.cart) {
          const already = cart.lines.find((line) => line.id === product.id)?.quantity ?? 0;
          cart.setQuantity(product, already + quantity);
        }
        push({ from: "munshi", kind: "reply", text: answer.data.reply, link: answer.data.link });
      } else if (error.success && error.data.error === "ai_not_configured") {
        push({ from: "munshi", kind: "notice", text: t("notConfigured"), sandbox: true });
      } else if (error.success && error.data.error === "busy") {
        push({ from: "munshi", kind: "error", text: t("busy") });
      } else {
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
  const working = speech.status === "working";

  if (listening || working) {
    return (
      <SheetBody>
        <VoiceScreen
          working={working}
          transcript={speech.transcript}
          onCancel={speech.cancel}
          onDone={speech.stop}
        />
      </SheetBody>
    );
  }

  return (
    <>
      <SheetBody>
        <div
          ref={listRef}
          className="flex h-full flex-col gap-3 overflow-y-auto"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="flex min-h-full flex-col justify-between gap-8 pt-3">
              <div className="font-heading text-3xl leading-tight font-bold text-balance">
                <p className="text-ink">
                  {name ? (
                    <>
                      {/* The salaam stays on one line; the name moves down if it must. */}
                      <span className="whitespace-nowrap">{t("salaam")}</span>{" "}
                      {t("helloName", { name })}
                    </>
                  ) : (
                    t("helloPlain")
                  )}
                </p>
                <p className="text-muted">{t("helpLine")}</p>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-sm font-semibold text-muted">{t("tryThese")}</p>
                <ul className="flex flex-col gap-2.5">
                  {suggestions.map(({ key, icons }) => {
                    const Icon = icons[role];
                    const text = t(`suggestions.${role}.${key}`);
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => {
                            haptic("tap");
                            void send(text);
                          }}
                          className="flex min-h-16 w-full items-center gap-3 rounded-[18px] border border-border/60 bg-surface p-3 text-start shadow-card transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none"
                        >
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mint-soft text-primary-strong">
                            <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                          </span>
                          <span className="min-w-0 flex-1 text-base font-medium text-ink">
                            {text}
                          </span>
                          <ArrowUpRight
                            aria-hidden
                            className="size-5 shrink-0 text-muted rtl:-scale-x-100"
                            strokeWidth={1.75}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : null}

          {messages.map((message) =>
            message.from === "user" ? (
              <p
                key={message.id}
                className="max-w-[85%] self-end rounded-[20px] rounded-ee-md bg-action px-4 py-2.5 text-base text-on-action"
                dir="auto"
              >
                {message.text}
              </p>
            ) : (
              <div
                key={message.id}
                className={cn(
                  "flex max-w-[90%] flex-col gap-1.5 self-start rounded-[20px] rounded-es-md px-4 py-3 text-base",
                  message.kind === "error"
                    ? "bg-danger-soft text-danger-ink"
                    : "bg-subtle text-ink",
                )}
              >
                {message.kind !== "reply" && message.sandbox ? (
                  <Badge variant="offer" size="sm">
                    {t("sandbox")}
                  </Badge>
                ) : null}
                <p className="whitespace-pre-line" dir="auto">
                  {message.text}
                </p>
                {message.kind === "reply" ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {message.link ? (
                      <Link
                        href={message.link.href}
                        onClick={() => setOpen(false)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-full bg-action px-4 text-sm font-semibold text-on-action"
                      >
                        {message.link.label}
                        <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => speak(message.text, speechLang[locale])}
                      aria-label={t("readAloud")}
                      className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-primary-strong shadow-card"
                    >
                      <Volume2 aria-hidden className="size-5" />
                    </button>
                  </div>
                ) : null}
              </div>
            ),
          )}

          {sending ? (
            <div className="flex items-center gap-2 self-start rounded-[20px] bg-subtle px-4 py-3 text-sm text-muted">
              <SpeedLines animated className="w-7" />
              {t("thinking")}
            </div>
          ) : null}
          {speech.status === "denied" ? (
            <p className="rounded-md bg-awning-soft px-3 py-2 text-sm text-awning-ink">
              {t("micDenied")}
            </p>
          ) : null}
        </div>
      </SheetBody>

      <SheetFooter className="border-t-0 pt-1">
        <form
          className="flex w-full items-end gap-2 rounded-[26px] border border-border bg-surface p-1.5 ps-4 shadow-card focus-within:border-primary focus-within:ring-3 focus-within:ring-ring"
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
            dir="auto"
            className="field-sizing-content max-h-32 min-h-12 flex-1 resize-none bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted"
          />
          {speech.supported && !input.trim() ? (
            <button
              type="button"
              aria-label={t("talk")}
              onClick={() => {
                haptic("tap");
                speech.start();
              }}
              className="sheen flex size-12 shrink-0 items-center justify-center rounded-full bg-action text-on-action shadow-glow inset-shadow-edge transition-transform duration-150 ease-out active:scale-95"
            >
              <Mic aria-hidden className="size-5" strokeWidth={1.75} />
            </button>
          ) : (
            <button
              type="submit"
              aria-label={t("send")}
              disabled={!input.trim() || sending}
              className="sheen flex size-12 shrink-0 items-center justify-center rounded-full bg-action text-on-action shadow-glow inset-shadow-edge transition-transform duration-150 ease-out active:scale-95 disabled:opacity-50 disabled:shadow-none"
            >
              <ArrowUp aria-hidden className="size-5" strokeWidth={2} />
            </button>
          )}
        </form>
      </SheetFooter>
    </>
  );
}

/**
 * Tez: talk or type. It opens on a greeting and three things to ask; the mic turns the whole
 * sheet into a listening screen with a live transcript. Requests go to /api/munshi under the
 * user's own session.
 */
function MunshiSheet({ role, name = "" }: { role: AppRole; name?: string }) {
  const t = useTranslations("munshi");
  const { open, setOpen, listenOnOpen, draft } = useMunshi();
  const desktop = useMediaQuery("(min-width: 1024px)");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side={desktop ? "end" : "bottom"}
        showCloseButton
        className={cn(desktop ? "" : "h-[90dvh]")}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {/* A wash of mint behind the header: the one place Tez looks different from a form. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 rounded-t-[inherit] bg-linear-to-b from-mint-soft to-transparent"
        />
        <SheetHeader className="flex flex-row items-center gap-3 pe-14">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-primary-strong shadow-card">
            <SpeedLines className="w-5" />
          </span>
          <div className="min-w-0">
            <SheetTitle>{t("title")}</SheetTitle>
            <SheetDescription>{t("subtitle")}</SheetDescription>
          </div>
        </SheetHeader>
        <MunshiPanel role={role} name={name} draft={draft} listenOnOpen={listenOnOpen} />
      </SheetContent>
    </Sheet>
  );
}

export { MunshiSheet };
