"use client";

import { useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { MessageSquareWarning, Minus, Plus, Repeat2, Star, Wallet, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { cancelOrder, rateOrder, reorderOrder, requestReturn } from "../actions";
import type { OrderingErrorKey } from "../errors";
import { cartKey } from "../keys";
import type { OrderStatus } from "../schemas";

type OrderSummary = {
  id: string;
  orgName: string;
  status: OrderStatus;
  rating: number | null;
  deliveredAt: string | null;
};
type ClaimItem = { id: string; name: string; maxQty: number };

const CLAIM_WINDOW_MS = 7 * 86_400_000;
const cancelReasons = ["mistake", "late", "price", "other"] as const;
const claimReasons = ["damaged", "short", "expired", "wrong_item", "quality", "other"] as const;

/** Reorder, cancel, rate and claim, each as a short confirmable step. */
function OrderActions({
  shopId,
  order,
  items,
}: {
  shopId: string;
  order: OrderSummary;
  items: ClaimItem[];
}) {
  const t = useTranslations("ordering");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [sheet, setSheet] = useState<"cancel" | "rate" | "claim" | null>(null);
  const [reason, setReason] = useState<(typeof cancelReasons)[number] | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [claimReason, setClaimReason] = useState<(typeof claimReasons)[number] | null>("damaged");
  const [claimQty, setClaimQty] = useState<Record<string, number>>({});
  // Fixed once per render of the page; the server checks the window again.
  const [now] = useState(() => Date.now());

  const delivered = order.status === "delivered" || order.status === "partially_delivered";
  const canCancel = order.status === "new" || order.status === "confirmed";
  const canRate = delivered && order.rating === null;
  const canClaim =
    delivered &&
    order.deliveredAt !== null &&
    now - new Date(order.deliveredAt).getTime() < CLAIM_WINDOW_MS;

  const fail = (error: OrderingErrorKey) => {
    haptic("warning");
    toast.error(t(`errors.${error}`));
  };

  const reorder = () =>
    startTransition(async () => {
      const result = await reorderOrder(order.id);
      if (!result.ok) return fail(result.error);
      queryClient.setQueryData(cartKey(shopId), result.data.cart);
      haptic("success");
      toast.success(t("orders.reordered", { count: result.data.added }), {
        description: result.data.skipped.length
          ? t("orders.reorderSkipped", { count: result.data.skipped.length })
          : undefined,
      });
      router.push("/dukan/cart");
    });

  const cancel = () =>
    startTransition(async () => {
      if (!reason) return fail("reason_required");
      const result = await cancelOrder({
        orderId: order.id,
        reason: t(`order.cancelReasons.${reason}`),
      });
      if (!result.ok) return fail(result.error);
      haptic("success");
      setSheet(null);
      toast.success(t("order.cancelled"));
    });

  const rate = () =>
    startTransition(async () => {
      const result = await rateOrder({
        orderId: order.id,
        rating: stars,
        comment: comment.trim() || undefined,
      });
      if (!result.ok) return fail(result.error);
      haptic("success");
      setSheet(null);
      toast.success(t("order.rated", { stars }));
    });

  const claim = () =>
    startTransition(async () => {
      const lines = Object.entries(claimQty)
        .filter(([, qty]) => qty > 0)
        .map(([orderItemId, baseQty]) => ({
          orderItemId,
          baseQty,
          reason: claimReason ?? "other",
        }));
      if (lines.length === 0) {
        haptic("warning");
        toast.error(t("order.problemNone"));
        return;
      }
      const result = await requestReturn({ orderId: order.id, items: lines });
      if (!result.ok) return fail(result.error);
      haptic("success");
      setSheet(null);
      setClaimQty({});
      toast.success(t("order.problemSent", { number: result.data.returnNumber }));
    });

  return (
    <section className="flex flex-col gap-3">
      {order.rating !== null ? (
        <p className="flex items-center justify-center gap-1.5 rounded-lg bg-awning-soft p-3 text-sm font-semibold text-awning-ink">
          <Star aria-hidden className="size-4 fill-current" />
          {t("order.rated", { stars: order.rating })}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={reorder} loading={pending && sheet === null}>
          <Repeat2 aria-hidden />
          {t("orders.reorder")}
        </Button>
        {canRate ? (
          <Button size="lg" variant="soft" onClick={() => setSheet("rate")}>
            <Star aria-hidden />
            {t("order.rate")}
          </Button>
        ) : (
          <Link href={`/dukan/ledger`} className={buttonVariants({ size: "lg", variant: "soft" })}>
            <Wallet aria-hidden />
            {t("orders.khata")}
          </Link>
        )}
        {canClaim ? (
          <Button size="lg" variant="secondary" onClick={() => setSheet("claim")}>
            <MessageSquareWarning aria-hidden />
            {t("order.problem")}
          </Button>
        ) : null}
        {canCancel ? (
          <Button size="lg" variant="danger-soft" onClick={() => setSheet("cancel")}>
            <XCircle aria-hidden />
            {t("order.cancel")}
          </Button>
        ) : null}
      </div>

      <Sheet open={sheet === "cancel"} onOpenChange={(open) => !open && setSheet(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("order.cancelTitle")}</SheetTitle>
            <SheetDescription>{t("order.cancelHint")}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <ChoiceChips
              options={cancelReasons}
              value={reason}
              onChange={setReason}
              label={t("order.cancelReason")}
              render={(value) => t(`order.cancelReasons.${value}`)}
            />
          </SheetBody>
          <SheetFooter>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setSheet(null)}>
              {tCommon("back")}
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              loading={pending}
              disabled={!reason}
              onClick={cancel}
            >
              {t("order.cancel")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={sheet === "rate"} onOpenChange={(open) => !open && setSheet(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("order.rate")}</SheetTitle>
            <SheetDescription>{t("order.rateHint", { name: order.orgName })}</SheetDescription>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-4">
            <div
              role="radiogroup"
              aria-label={t("order.rate")}
              className="flex justify-center gap-2"
              dir="ltr"
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={stars === value}
                  aria-label={t("order.ratingStars", { stars: value })}
                  onClick={() => {
                    haptic("tap");
                    setStars(value);
                  }}
                  className="flex size-12 items-center justify-center rounded-full transition-transform active:scale-90"
                >
                  <Star
                    aria-hidden
                    className={cn(
                      "size-9",
                      value <= stars ? "fill-awning text-awning" : "text-border-strong",
                    )}
                  />
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              {t("order.comment")}
              <Textarea
                value={comment}
                maxLength={1000}
                rows={2}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
          </SheetBody>
          <SheetFooter>
            <Button size="lg" block loading={pending} disabled={stars === 0} onClick={rate}>
              {t("order.submitRating")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={sheet === "claim"} onOpenChange={(open) => !open && setSheet(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("order.problemTitle")}</SheetTitle>
            <SheetDescription>{t("order.problemHint")}</SheetDescription>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-4">
            <ChoiceChips
              options={claimReasons}
              value={claimReason}
              onChange={setClaimReason}
              label={t("order.problemTitle")}
              render={(value) => t(`order.problemReason.${value}`)}
            />
            <ul className="flex flex-col divide-y divide-border/70">
              {items.map((item) => {
                const qty = claimQty[item.id] ?? 0;
                const set = (next: number) =>
                  setClaimQty((current) => ({
                    ...current,
                    [item.id]: Math.max(0, Math.min(item.maxQty, next)),
                  }));
                return (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
                      {item.name}
                    </span>
                    <span className="flex items-center gap-1" dir="ltr">
                      <button
                        type="button"
                        aria-label={t("order.problemPieces")}
                        disabled={qty === 0}
                        onClick={() => set(qty - 1)}
                        className="flex size-10 items-center justify-center rounded-full bg-subtle disabled:opacity-40"
                      >
                        <Minus aria-hidden className="size-4" />
                      </button>
                      <span className="num w-8 text-center font-bold" aria-live="polite">
                        {qty}
                      </span>
                      <button
                        type="button"
                        aria-label={t("order.problemPieces")}
                        disabled={qty >= item.maxQty}
                        onClick={() => set(qty + 1)}
                        className="flex size-10 items-center justify-center rounded-full bg-subtle disabled:opacity-40"
                      >
                        <Plus aria-hidden className="size-4" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </SheetBody>
          <SheetFooter>
            <Button size="lg" block loading={pending} onClick={claim}>
              {t("order.problemSubmit")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}

export { OrderActions };
