import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { formatRs } from "@/lib/money";
import { getShopDistributors, requireDukan } from "../data";
import { first } from "./params";
import { ListingSkeleton, ProductListing } from "./product-listing";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function DistributorContent({ params, searchParams }: Props) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { shopId } = await requireDukan(`/dukan/distributors/${id}`);
  const [distributors, query, t] = await Promise.all([
    getShopDistributors(shopId),
    searchParams,
    getTranslations("ordering"),
  ]);
  const distributor = distributors.find((d) => d.org_id === id);
  if (!distributor) notFound();
  return (
    <ProductListing
      shopId={shopId}
      title={distributor.name}
      subtitle={`${t("products", { count: distributor.product_count })} · ${t("distributors.minimum", { amount: formatRs(distributor.min_order_paisa) })}`}
      basePath={`/dukan/distributors/${id}`}
      backHref="/dukan/distributors"
      params={{ sort: first(query.sort), stock: first(query.stock), schemes: first(query.schemes) }}
      browse={{ orgId: id }}
    />
  );
}

export function DistributorListing(props: Props) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <DistributorContent {...props} />
    </Suspense>
  );
}
