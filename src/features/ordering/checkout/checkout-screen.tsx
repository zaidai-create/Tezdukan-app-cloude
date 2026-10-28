"use client";

import { useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Banknote, CalendarClock, MapPin, ShoppingBasket, Store, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/states/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { formatRs } from "@/lib/money";
import { placeOrder } from "../actions";
import { groupBlocked } from "../cart/cart-screen";
import { cartKey } from "../keys";
import { deliveryDay, slotWindow } from "../labels";
import { useCart, useDeliverySlots } from "../queries";
import { emptyCart, type CartGroup, type PaymentMethod, type Slot } from "../schemas";

type Shop = { name: string; address_line: string | null; phone: string | null };

function SlotPicker({
  shopId,
  group,
  value,
  onChange,
}: {
  shopId: string;
  group: CartGroup;
  value: Slot | undefined;
  onChange: (slot: Slot) => void;
}) {
  const t = useTranslations("ordering");
  const slots = useDeliverySlots(shopId, group.org_id);
  const options: Slot[] = slots.data
    ? slots.data.slice(0, 8).map((s) => ({ start: s.slot_start, end: s.slot_end }))
    : group.next_slots;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <CalendarClock aria-hidden className="size-4 text-muted" />
        {t("checkout.slotFor", { name: group.org_name })}
      </legend>
      <div role="radiogroup" className="grid grid-cols-2 gap-2">
        {options.map((slot) => {
          const selected = value?.start === slot.start;
          return (
            <button
              key={slot.start}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(slot)}
              className={cn(
                "num flex min-h-14 flex-col items-start justify-center rounded-md border-[1.5px] px-3 text-start transition-colors",
                selected
                  ? "border-primary bg-primary-soft text-primary-strong"
                  : "border-border bg-surface text-ink hover:bg-subtle",
              )}
            >
              <span className="block text-sm font-semibold first-letter:uppercase">
                {deliveryDay(t, slot.start)}
              </span>
              <span className="text-xs">{slotWindow(t, slot.start, slot.end)}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Checkout: where it goes, when each distributor delivers, how to pay, and one button that
 * places every distributor's order at once (or none). Retries reuse the same request id, so
 * a flaky connection can never order twice.
 */
function CheckoutScreen({ shopId, shop }: { shopId: string; shop: Shop }) {
  const t = useTranslations("ordering");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: cart } = useCart(shopId);
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [method, setMethod] = useState<PaymentMethod>("cod");
  const [notes, setNotes] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => cart?.groups ?? [], [cart]);

  // Each distributor starts on its first slot until the dukandar picks another.
  const chosen: Record<string, Slot> = {};
  for (const group of groups) {
    const slot = slots[group.org_id] ?? group.next_slots[0];
    if (slot) chosen[group.org_id] = slot;
  }

  if (!cart || groups.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBasket}
        title={t("cart.emptyTitle")}
        action={
          <Link href="/dukan" className={buttonVariants({ size: "lg" })}>
            {t("cart.startShopping")}
          </Link>
        }
      />
    );
  }

  const creditOk = groups.every(
    (g) => g.account_status === "active" && g.credit_available_paisa >= g.total_paisa,
  );
  // Credit can stop being possible while the dukandar edits the cart; fall back to cash.
  const payment: PaymentMethod = method === "credit" && !creditOk ? "cod" : method;
  const blocked = groups.some(groupBlocked);
  const missingSlot = groups.find((g) => !chosen[g.org_id]);

  const submit = () => {
    if (missingSlot) {
      toast.error(t("checkout.pickSlot", { name: missingSlot.org_name }));
      return;
    }
    startTransition(async () => {
      const result = await placeOrder({
        shopId,
        clientRequestId: requestId,
        paymentMethod: payment,
        slots: chosen,
        notes: notes.trim() || undefined,
      });
      if (!result.ok) {
        haptic("warning");
        toast.error(t(`errors.${result.error}`));
        if (result.error === "slot_unavailable") {
          await queryClient.invalidateQueries({ queryKey: ["slots", shopId] });
        }
        await queryClient.invalidateQueries({ queryKey: cartKey(shopId) });
        return;
      }
      haptic("success");
      queryClient.setQueryData(cartKey(shopId), emptyCart);
      router.replace(`/dukan/orders/placed?ids=${result.data.orders.map((o) => o.id).join(",")}`);
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <h1 className="font-heading text-2xl font-extrabold text-ink lg:text-3xl">
        {t("checkout.title")}
      </h1>

      <section className="flex items-start gap-3 rounded-lg border border-border/70 bg-surface p-4 shadow-card">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
          <MapPin aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted uppercase">{t("checkout.deliverTo")}</p>
          <p className="font-heading font-bold text-ink">{shop.name}</p>
          {shop.address_line ? <p className="text-sm text-muted">{shop.address_line}</p> : null}
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-lg border border-border/70 bg-surface p-4 shadow-card">
        <h2 className="font-heading text-lg font-bold text-ink">{t("checkout.slot")}</h2>
        {groups.map((group) => (
          <SlotPicker
            key={group.org_id}
            shopId={shopId}
            group={group}
            value={chosen[group.org_id]}
            onChange={(slot) => setSlots((s) => ({ ...s, [group.org_id]: slot }))}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border/70 bg-surface p-4 shadow-card">
        <h2 className="font-heading text-lg font-bold text-ink">{t("checkout.payment")}</h2>
        <div role="radiogroup" aria-label={t("checkout.payment")} className="flex flex-col gap-2">
          {(
            [
              {
                id: "cod",
                icon: Banknote,
                title: t("checkout.cod"),
                hint: t("checkout.codHint"),
                disabled: false,
              },
              {
                id: "credit",
                icon: Wallet,
                title: t("checkout.credit"),
                hint: creditOk
                  ? t("checkout.creditHint", {
                      amount: formatRs(Math.min(...groups.map((g) => g.credit_available_paisa))),
                    })
                  : t("checkout.creditUnavailable"),
                disabled: !creditOk,
              },
            ] as const
          ).map((option) => {
            const selected = payment === option.id;
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={option.disabled}
                onClick={() => setMethod(option.id)}
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-md border-[1.5px] px-4 text-start transition-colors disabled:opacity-50",
                  selected
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface hover:bg-subtle",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn("size-6 shrink-0", selected ? "text-primary-strong" : "text-muted")}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{option.title}</span>
                  <span className="num block text-sm text-muted">{option.hint}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "size-5 shrink-0 rounded-full border-2",
                    selected
                      ? "border-primary bg-primary ring-4 ring-primary-soft ring-inset"
                      : "border-border-strong",
                  )}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-border/70 bg-surface p-4 shadow-card">
        <label htmlFor="order-notes" className="font-heading text-base font-bold text-ink">
          {t("checkout.notes")}
        </label>
        <Textarea
          id="order-notes"
          value={notes}
          maxLength={1000}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t("checkout.notesPlaceholder")}
          rows={2}
        />
      </section>

      <section className="rounded-lg border border-border/70 bg-surface p-4 shadow-card">
        <h2 className="mb-2 font-heading text-lg font-bold text-ink">{t("checkout.summary")}</h2>
        <ul className="num flex flex-col gap-2 text-sm">
          {groups.map((group) => (
            <li key={group.org_id} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-ink">
                <Store aria-hidden className="size-4 shrink-0 text-muted" />
                <span className="truncate">{group.org_name}</span>
                <span className="shrink-0 text-muted">
                  · {t("cart.items", { count: group.items.length })}
                </span>
              </span>
              <span className="font-semibold text-ink">{formatRs(group.total_paisa)}</span>
            </li>
          ))}
        </ul>
        <div className="num mt-3 flex justify-between border-t border-border/70 pt-3 font-heading text-lg font-extrabold text-ink">
          <span>{t("cart.grandTotal")}</span>
          <span>{formatRs(cart.total_paisa)}</span>
        </div>
      </section>

      <div className="material sticky bottom-[calc(var(--bottom-nav-space)+10px)] z-30 rounded-2xl p-1.5 shadow-float lg:bottom-6">
        <Button
          size="lg"
          block
          loading={pending}
          disabled={blocked}
          onClick={submit}
          className="h-16 rounded-xl text-lg"
        >
          <span className="num">
            {pending
              ? t("checkout.placing")
              : t("checkout.place", { total: formatRs(cart.total_paisa) })}
          </span>
        </Button>
      </div>
    </div>
  );
}

export { CheckoutScreen };
