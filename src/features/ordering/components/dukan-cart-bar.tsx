"use client";

import { CartBar } from "@/components/commerce/cart-bar";
import { useCart } from "../queries";

/** The floating cart bar for dukandar browsing screens, fed by the server cart. */
function DukanCartBar({ shopId }: { shopId: string }) {
  const { data } = useCart(shopId);
  const savings = (data?.groups ?? []).reduce((sum, group) => sum + group.scheme_discount_paisa, 0);
  return (
    <CartBar
      itemCount={data?.item_count ?? 0}
      totalPaisa={data?.total_paisa ?? 0}
      savingsPaisa={savings}
      href="/dukan/cart"
    />
  );
}

export { DukanCartBar };
