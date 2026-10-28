import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CartBoundary } from "../components/cart-boundary";
import { getCart, requireDukan } from "../data";
import { CartScreen } from "./cart-screen";

function CartSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-72 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}

async function CartContent() {
  await connection();
  const { shopId } = await requireDukan("/dukan/cart");
  const cart = await getCart(shopId);
  return (
    <CartBoundary shopId={shopId} cart={cart}>
      <CartScreen shopId={shopId} />
    </CartBoundary>
  );
}

export function CartPage() {
  return (
    <Suspense fallback={<CartSkeleton />}>
      <CartContent />
    </Suspense>
  );
}
