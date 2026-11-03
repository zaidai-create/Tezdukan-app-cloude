"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCustomerCart } from "@/features/storefront/cart-store";
import { useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { getReorderLines } from "../actions";

/** Puts what is still available from this order back in the cart, at today's prices. */
export function OrderAgainButton({ orderId }: { orderId: string }) {
  const t = useTranslations("customerOrders");
  const setQuantity = useCustomerCart((state) => state.setQuantity);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      block
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await getReorderLines(orderId);
          if (!result.ok) {
            toast.error(t(`errors.${result.error}`));
            return;
          }
          if (result.data.length === 0) {
            toast(t("orderAgainNone"));
            return;
          }
          for (const line of result.data) setQuantity(line, line.qty);
          haptic("success");
          toast.success(t("orderAgainAdded", { count: result.data.length }));
          router.push("/cart");
        })
      }
    >
      <RotateCcw aria-hidden />
      {t("orderAgain")}
    </Button>
  );
}
