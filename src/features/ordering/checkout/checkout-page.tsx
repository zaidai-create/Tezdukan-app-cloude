import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CartBoundary } from "../components/cart-boundary";
import { getCart, getShopAddress, requireDukan } from "../data";
import { CheckoutScreen } from "./checkout-screen";

function CheckoutSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}

async function CheckoutContent() {
  await connection();
  const { shopId } = await requireDukan("/dukan/checkout");
  const [cart, shop] = await Promise.all([getCart(shopId), getShopAddress(shopId)]);
  return (
    <CartBoundary shopId={shopId} cart={cart}>
      <CheckoutScreen shopId={shopId} shop={shop} />
    </CartBoundary>
  );
}

export function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent />
    </Suspense>
  );
}
