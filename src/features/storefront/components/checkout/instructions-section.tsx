"use client";

import { cn } from "cn";
import { Check, NotebookPen, PackageX, PhoneCall, Repeat, Trash2, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { deliveryInstructions, unavailableChoices, useCustomerCart } from "../../cart-store";

const choiceIcon = { call_me: PhoneCall, replace: Repeat, remove: Trash2 } as const;

/**
 * What the dukan should do when something is not on its shelf: call, send something similar
 * (same price or less), or just leave it out. Asked once, before the order goes.
 */
export function UnavailableSection() {
  const t = useTranslations("storefront.cart.unavailable");
  const choice = useCustomerCart((state) => state.ifUnavailable);
  const setDelivery = useCustomerCart((state) => state.setDelivery);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
          <PackageX aria-hidden className="size-5 text-primary" />
          {t("title")}
        </h2>
        <p className="text-sm text-muted">{t("hint")}</p>
      </div>
      <div role="radiogroup" aria-label={t("title")} className="grid grid-cols-3 gap-2">
        {unavailableChoices.map((option) => {
          const Icon = choiceIcon[option];
          const on = choice === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setDelivery({ ifUnavailable: option })}
              className={cn(
                "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-2 py-2.5 text-center text-sm leading-tight font-semibold transition-colors duration-150",
                on
                  ? "border-primary bg-primary-soft text-primary-strong"
                  : "border-border bg-surface text-ink",
              )}
            >
              <Icon aria-hidden className="size-5" strokeWidth={1.75} />
              {t(option)}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted">{t(`${choice}Hint`)}</p>
    </section>
  );
}

/** Tap-to-pick delivery instructions and a short note, sent to the dukan with the order. */
export function InstructionsSection() {
  const t = useTranslations("storefront.cart");
  const instructions = useCustomerCart((state) => state.instructions);
  const note = useCustomerCart((state) => state.note);
  const toggle = useCustomerCart((state) => state.toggleInstruction);
  const setDelivery = useCustomerCart((state) => state.setDelivery);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
        <NotebookPen aria-hidden className="size-5 text-primary" />
        {t("instructionsTitle")}
      </h2>
      <div className="flex flex-wrap gap-2">
        {deliveryInstructions.map((item) => {
          const on = instructions.includes(item);
          return (
            <button
              key={item}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(item)}
              className={cn(
                "relative inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors duration-150 after:absolute after:-inset-1",
                on
                  ? "border-primary bg-primary-soft text-primary-strong"
                  : "border-border-strong bg-surface text-ink",
              )}
            >
              {on ? <Check aria-hidden className="size-4" /> : null}
              {t(`instructions.${item}`)}
            </button>
          );
        })}
      </div>
      <Textarea
        value={note}
        onChange={(event) => setDelivery({ note: event.target.value.slice(0, 200) })}
        maxLength={200}
        placeholder={t("notePlaceholder")}
        aria-label={t("notePlaceholder")}
        className="min-h-20"
      />
    </section>
  );
}

/** One way to pay for now, said plainly. */
export function PaymentSection() {
  const t = useTranslations("storefront.cart");
  return (
    <section className="flex items-center gap-3 rounded-lg border border-primary/30 bg-surface p-4 shadow-card">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
        <Wallet aria-hidden className="size-6" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{t("paymentTitle")}</p>
        <p className="font-semibold text-ink">{t("codTitle")}</p>
        <p className="text-sm text-muted">{t("codHint")}</p>
      </div>
      <span
        aria-hidden
        className="flex size-6 items-center justify-center rounded-full bg-action text-on-action"
      >
        <Check className="size-4" strokeWidth={2.5} />
      </span>
    </section>
  );
}
