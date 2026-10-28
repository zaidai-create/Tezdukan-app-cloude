"use client";

import { useCart } from "../queries";

/** Keeps the nav's cart badge current on every dukandar screen (it renders nothing). */
function CartCountSync({ shopId }: { shopId: string }) {
  useCart(shopId);
  return null;
}

export { CartCountSync };
