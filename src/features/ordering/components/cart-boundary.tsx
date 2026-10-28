import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { cartKey } from "../keys";
import type { CartSummary } from "../schemas";

/**
 * Hands the cart read on the server to the client cache, so steppers and the cart bar render
 * with the right quantities on first paint instead of fetching again.
 */
function CartBoundary({
  shopId,
  cart,
  children,
}: {
  shopId: string;
  cart: CartSummary;
  children: ReactNode;
}) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(cartKey(shopId), cart);
  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}

export { CartBoundary };
