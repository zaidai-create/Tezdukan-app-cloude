"use client";

import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRelativeTime } from "@/hooks/use-relative-time";
import { haptic } from "@/lib/haptics";
import { formatRs } from "@/lib/money";
import { confirmOrderAsShop } from "../actions";

/**
 * A big order waits for the dukandar's word before it ships. Shown on a new order that needs
 * one: a prompt (louder once the distributor has asked) and, afterwards, the confirmation.
 */
export function ShopConfirm({
  orderId,
  orgName,
  totalPaisa,
  requestedAt,
  confirmedAt,
}: {
  orderId: string;
  orgName: string;
  totalPaisa: number;
  requestedAt: string | null;
  confirmedAt: string | null;
}) {
  const t = useTranslations("ordering");
  const confirmedAgo = useRelativeTime(confirmedAt);
  const [pending, startTransition] = useTransition();

  if (confirmedAt) {
    return (
      <section className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft p-4">
        <ShieldCheck aria-hidden className="size-6 shrink-0 text-primary-strong" />
        <p className="font-semibold text-primary-strong">
          {t("order.confirmedByYou", { time: confirmedAgo })}
        </p>
      </section>
    );
  }

  return (
    <section
      className={
        requestedAt
          ? "flex flex-col gap-3 rounded-xl border border-awning/60 bg-awning-soft p-4 shadow-card"
          : "flex flex-col gap-3 rounded-xl border border-border/70 bg-surface p-4 shadow-card"
      }
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-awning text-on-awning">
          <ShieldQuestion aria-hidden className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg leading-snug font-bold text-ink">
            {requestedAt
              ? t("order.confirmAsked", { org: orgName })
              : t("order.confirmBig", { org: orgName })}
          </h2>
          <p className="num mt-1 text-sm text-ink">
            {t("order.confirmBody", { total: formatRs(totalPaisa) })}
          </p>
        </div>
      </div>
      <Button
        size="lg"
        block
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await confirmOrderAsShop(orderId);
            if (!result.ok) {
              haptic("warning");
              toast.error(t(`errors.${result.error}`));
              return;
            }
            haptic("success");
            toast.success(t("order.confirmDone", { org: orgName }));
          })
        }
      >
        <ShieldCheck aria-hidden />
        {t("order.confirmButton")}
      </Button>
    </section>
  );
}
