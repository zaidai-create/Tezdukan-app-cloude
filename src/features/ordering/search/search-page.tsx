import { connection } from "next/server";
import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/states/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { CartBoundary } from "../components/cart-boundary";
import { DukanCartBar } from "../components/dukan-cart-bar";
import { ProductSheet } from "../components/product-sheet";
import { getCart, getFacets, requireDukan } from "../data";
import { first } from "../listing/params";
import { SearchScreen } from "./search-screen";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function SearchSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4" aria-hidden>
      <Skeleton className="h-14 w-full rounded-full" />
      <ProductGridSkeleton count={4} />
    </div>
  );
}

async function SearchContent({ searchParams }: Props) {
  await connection();
  const { shopId } = await requireDukan("/dukan/search");
  const [query, cart, facets] = await Promise.all([
    searchParams,
    getCart(shopId),
    getFacets(shopId),
  ]);
  return (
    <CartBoundary shopId={shopId} cart={cart}>
      <SearchScreen
        shopId={shopId}
        initialQuery={first(query.q) ?? ""}
        categories={facets.categories}
        brands={facets.brands.slice(0, 8)}
      />
      <ProductSheet shopId={shopId} />
      <DukanCartBar shopId={shopId} />
    </CartBoundary>
  );
}

export function SearchPage(props: Props) {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchContent {...props} />
    </Suspense>
  );
}
