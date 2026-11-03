import { connection } from "next/server";
import { Suspense } from "react";
import { ListRowSkeleton } from "@/components/states/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { requireDukan } from "@/features/ordering/data";
import { ProductsView } from "./components/products-view";
import { getShopProducts, getStarterPack } from "./data";

function ProductsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <Skeleton className="h-12 w-full rounded-md" />
      <div className="rounded-lg border border-border bg-surface px-4">
        <ListRowSkeleton />
        <ListRowSkeleton />
        <ListRowSkeleton />
      </div>
    </div>
  );
}

async function ProductsContent() {
  await connection();
  const { shopId } = await requireDukan("/dukan/products");
  const [products, starter] = await Promise.all([getShopProducts(shopId), getStarterPack(shopId)]);
  return <ProductsView products={products} starter={starter} />;
}

/** The dukandar's products: add (type, speak or the common pack), re-price, count stock. */
export function ProductsPage() {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <ProductsContent />
    </Suspense>
  );
}
