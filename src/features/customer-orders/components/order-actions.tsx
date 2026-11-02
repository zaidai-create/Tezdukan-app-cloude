"use client";

import { Check, PackageCheck, Truck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { haptic } from "@/lib/haptics";
import { updateCustomerOrderStatus } from "../actions";
import type { CustomerOrderStatus } from "../schemas";

function useMove(orderId: string) {
  const t = useTranslations("customerOrders");
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<CustomerOrderStatus | null>(null);
  const move = (to: CustomerOrderStatus, reason?: string) => {
    setStep(to);
    startTransition(async () => {
      const result = await updateCustomerOrderStatus(orderId, to, reason);
      if (!result.ok) {
        haptic("warning");
        toast.error(t(`errors.${result.error}`));
        return;
      }
      haptic("success");
      toast.success(t(`moved.${to}`));
    });
  };
  return { move, pending, step };
}

/** The dukandar's next step for an order, pinned above the nav dock. */
export function ShopOrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: CustomerOrderStatus;
}) {
  const t = useTranslations("customerOrders");
  const { move, pending, step } = useMove(orderId);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<"r1" | "r2" | "r3">("r1");
  const loading = (to: CustomerOrderStatus) => pending && step === to;

  if (status === "delivered" || status === "cancelled" || status === "rejected") return null;

  return (
    <>
      <StickyActionBar className="flex flex-col gap-1.5">
        {status === "placed" ? (
          <div className="flex gap-1.5">
            <Button
              variant="danger-soft"
              size="lg"
              className="shrink-0 px-4"
              onClick={() => setRejecting(true)}
            >
              <X aria-hidden />
              {t("actions.reject")}
            </Button>
            <Button
              size="lg"
              className="min-w-0 flex-1"
              loading={loading("accepted")}
              onClick={() => move("accepted")}
            >
              <Check aria-hidden />
              <span className="truncate">{t("actions.accept")}</span>
            </Button>
          </div>
        ) : status === "out_for_delivery" ? (
          <Button size="lg" block loading={loading("delivered")} onClick={() => move("delivered")}>
            <PackageCheck aria-hidden />
            {t("actions.delivered")}
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              block
              loading={loading("out_for_delivery")}
              onClick={() => move("out_for_delivery")}
            >
              <Truck aria-hidden />
              {t("actions.outForDelivery")}
            </Button>
            <div className="flex gap-1.5">
              {status === "accepted" ? (
                <Button
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  loading={loading("packed")}
                  onClick={() => move("packed")}
                >
                  {t("actions.packed")}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                loading={loading("delivered")}
                onClick={() => move("delivered")}
              >
                {t("actions.delivered")}
              </Button>
            </div>
          </>
        )}
      </StickyActionBar>

      <Sheet open={rejecting} onOpenChange={setRejecting}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{t("actions.rejectTitle")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-6">
            <ChoiceChips
              options={["r1", "r2", "r3"] as const}
              value={reason}
              onChange={setReason}
              label={t("actions.rejectTitle")}
              render={(value) => t(`reasons.${value}`)}
            />
            <Button
              variant="danger"
              size="lg"
              block
              loading={loading("rejected")}
              onClick={() => {
                move("rejected", t(`reasons.${reason}`));
                setRejecting(false);
              }}
            >
              {t("actions.confirmReject")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** The customer may cancel while the dukan hasn't accepted yet. */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const t = useTranslations("customerOrders");
  const { move, pending } = useMove(orderId);
  return (
    <Button
      variant="danger-soft"
      size="lg"
      block
      loading={pending}
      onClick={() => move("cancelled")}
    >
      <X aria-hidden />
      {t("actions.cancel")}
    </Button>
  );
}
