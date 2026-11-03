"use client";

import { cn } from "cn";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { haptic } from "@/lib/haptics";
import { rateOrder } from "../actions";

/** Five big stars and an optional comment for the dukan, once the order is delivered. */
export function RateOrder({
  orderId,
  shop,
  current,
}: {
  orderId: string;
  shop: string;
  current: { rating: number; comment: string | null } | null;
}) {
  const t = useTranslations("customerOrders.rate");
  const tErrors = useTranslations("customerOrders.errors");
  const [rating, setRating] = useState(current?.rating ?? 0);
  const [comment, setComment] = useState(current?.comment ?? "");
  const [editing, setEditing] = useState(!current);
  const [pending, startTransition] = useTransition();

  if (!editing && current) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
        <div>
          <p className="font-semibold text-ink">{t("thanks", { shop })}</p>
          <p className="flex gap-0.5 pt-1" aria-label={t("stars", { count: current.rating })}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Star
                key={value}
                aria-hidden
                className={cn(
                  "size-5",
                  value <= current.rating ? "fill-awning text-awning" : "text-border-strong",
                )}
              />
            ))}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          {t("change")}
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <div>
        <h2 className="font-heading text-lg font-bold text-ink">{t("title", { shop })}</h2>
        <p className="text-sm text-muted">{t("hint")}</p>
      </div>
      <div
        role="radiogroup"
        aria-label={t("title", { shop })}
        className="flex justify-between gap-1"
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={t("stars", { count: value })}
            onClick={() => {
              haptic("tap");
              setRating(value);
            }}
            className="flex size-14 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-90"
          >
            <Star
              aria-hidden
              className={cn(
                "size-9 transition-colors duration-150",
                value <= rating ? "fill-awning text-awning" : "text-border-strong",
              )}
              strokeWidth={1.75}
            />
          </button>
        ))}
      </div>
      {rating > 0 ? (
        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={1000}
          placeholder={t("commentPlaceholder")}
          aria-label={t("commentPlaceholder")}
        />
      ) : null}
      <Button
        block
        disabled={rating === 0}
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await rateOrder(orderId, rating, comment);
            if (!result.ok) {
              toast.error(tErrors(result.error));
              return;
            }
            haptic("success");
            toast.success(t("thanks", { shop }));
            setEditing(false);
          })
        }
      >
        {t("submit")}
      </Button>
    </section>
  );
}
