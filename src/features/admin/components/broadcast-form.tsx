"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { BellRing, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { haptic } from "@/lib/haptics";
import { formatPkMobileInput, normalizePkMobile } from "@/lib/phone";
import { getBroadcastReach, sendBroadcast } from "../actions";
import { type BroadcastAudience, broadcastAudiences } from "../schemas";

const linkOptions = [
  { value: "none", label: "none" },
  { value: "/", label: "home" },
  { value: "/orders", label: "orders" },
  { value: "/account/support", label: "support" },
] as const;
type LinkValue = (typeof linkOptions)[number]["value"];

/**
 * Write a notification and send it to a group (customers, dukandars, distributors, everyone)
 * or one person by phone number. Shows who it reaches and how it looks on a phone before it
 * goes, and asks once more before sending.
 */
export function BroadcastForm() {
  const t = useTranslations("admin.broadcast");
  const ids = { title: useId(), body: useId(), phone: useId(), link: useId() };
  const [audience, setAudience] = useState<BroadcastAudience>("customers");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState<LinkValue>("/");
  const [confirming, setConfirming] = useState(false);
  const [sending, startSending] = useTransition();

  const reach = useQuery({
    queryKey: ["admin", "broadcast-reach", audience],
    queryFn: async () => {
      if (audience === "one") return null;
      const result = await getBroadcastReach(audience);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: audience !== "one",
    staleTime: 60_000,
  });

  const e164 = audience === "one" ? normalizePkMobile(phone) : null;
  const ready =
    title.trim().length > 0 && body.trim().length > 0 && (audience !== "one" || e164 !== null);

  const send = () =>
    startSending(async () => {
      const result = await sendBroadcast({
        audience,
        title,
        body,
        link,
        phone: e164 ?? undefined,
      });
      setConfirming(false);
      if (!result.ok) {
        haptic("warning");
        toast.error(t(`errors.${result.error}`));
        return;
      }
      haptic("success");
      toast.success(t("sent", { sent: result.data.sent, push: result.data.push }));
      setTitle("");
      setBody("");
    });

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold text-ink">{t("to")}</legend>
          <div role="radiogroup" aria-label={t("to")} className="flex flex-wrap gap-2">
            {broadcastAudiences.map((option) => {
              const on = audience === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setAudience(option)}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors duration-150",
                    on
                      ? "border-primary bg-primary-soft text-primary-strong"
                      : "border-border-strong bg-surface text-ink",
                  )}
                >
                  {t(`audience.${option}`)}
                </button>
              );
            })}
          </div>
          <p className="num text-sm text-muted" aria-live="polite">
            {audience === "one"
              ? t("reachOne")
              : reach.data
                ? t("reach", { people: reach.data.people, push: reach.data.with_push })
                : t("reachLoading")}
          </p>
        </fieldset>

        {audience === "one" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.phone} className="font-semibold text-ink">
              {t("phone")}
            </label>
            <Input
              id={ids.phone}
              type="tel"
              inputMode="tel"
              dir="ltr"
              autoComplete="off"
              value={phone}
              placeholder="0300 1234567"
              onChange={(event) => setPhone(formatPkMobileInput(event.target.value).value)}
              aria-describedby={`${ids.phone}-hint`}
            />
            <p id={`${ids.phone}-hint`} className="text-sm text-muted">
              {t("phoneHint")}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.title} className="flex justify-between font-semibold text-ink">
            {t("titleLabel")}
            <span className="num text-xs font-normal text-muted">{`${title.length}/80`}</span>
          </label>
          <Input
            id={ids.title}
            value={title}
            maxLength={80}
            placeholder={t("titlePlaceholder")}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.body} className="flex justify-between font-semibold text-ink">
            {t("bodyLabel")}
            <span className="num text-xs font-normal text-muted">{`${body.length}/300`}</span>
          </label>
          <Textarea
            id={ids.body}
            value={body}
            maxLength={300}
            placeholder={t("bodyPlaceholder")}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-28"
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold text-ink">{t("linkLabel")}</legend>
          <div role="radiogroup" aria-label={t("linkLabel")} className="flex flex-wrap gap-2">
            {linkOptions.map((option) => {
              const on = link === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setLink(option.value)}
                  className={cn(
                    "min-h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-150",
                    on
                      ? "border-primary bg-primary-soft text-primary-strong"
                      : "border-border bg-surface text-ink",
                  )}
                >
                  {t(`links.${option.label}`)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Button size="lg" disabled={!ready} onClick={() => setConfirming(true)}>
          <Send aria-hidden className="rtl:-scale-x-100" />
          {t("send")}
        </Button>
      </div>

      <aside className="flex flex-col gap-2 lg:sticky lg:top-24 lg:self-start">
        <h2 className="text-sm font-semibold text-muted">{t("preview")}</h2>
        <div className="rounded-[22px] bg-ink p-3">
          <div className="flex gap-3 rounded-2xl bg-surface/95 p-3 shadow-raised">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-action text-on-action">
              <BellRing aria-hidden className="size-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-bold text-ink">
                  {title || t("titlePlaceholder")}
                </span>
                <span className="shrink-0 text-xs text-muted">{t("now")}</span>
              </span>
              <span className="line-clamp-3 text-sm text-ink/80">
                {body || t("bodyPlaceholder")}
              </span>
            </span>
          </div>
        </div>
      </aside>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("confirmBody", {
                audience:
                  audience === "one" && e164 ? phone : t(`audience.${audience}`).toLowerCase(),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
            <Button loading={sending} onClick={send}>
              {t("confirmSend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
