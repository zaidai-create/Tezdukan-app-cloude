"use client";

import { CartBar } from "@/components/commerce/cart-bar";
import { cartItemCount, useCustomerCart } from "../cart-store";

/** The floating "View cart" bar on shopping screens once something is in the cart. */
export function CustomerCartBar() {
  const lines = useCustomerCart((state) => state.lines);
  const total = lines.reduce((sum, line) => sum + line.pricePaisa * line.quantity, 0);
  const savings = lines.reduce(
    (sum, line) =>
      sum + Math.max((line.mrpPaisa ?? line.pricePaisa) - line.pricePaisa, 0) * line.quantity,
    0,
  );
  return (
    <CartBar
      itemCount={cartItemCount(lines)}
      totalPaisa={total}
      savingsPaisa={savings}
      href="/cart"
    />
  );
}
