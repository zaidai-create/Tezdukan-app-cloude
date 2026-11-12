import { Store, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ListRowSkeleton } from "@/components/states/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/session";
import { AdminHeader, AdminPageShell, LinkTabs, ListCard, TableHead } from "../components/admin-ui";
import { entityColumns } from "../components/columns";
import { type EntitySummary, EntityRow } from "../components/entity-row";
import { SearchBox } from "../components/search-box";
import { getAdminOrgs, getAdminShops, getDocumentOwners } from "../data";
import { adminStatuses, adminStatusFilterSchema } from "../schemas";
import { first, type SearchParams } from "./shared";

type Kind = "shops" | "distributors";

async function DirectoryContent({
  kind,
  searchParams,
}: {
  kind: Kind;
  searchParams: SearchParams;
}) {
  await connection();
  const base = kind === "shops" ? "/admin/shops" : "/admin/distributors";
  await requireRole("admin", base);
  const params = await searchParams;
  const status = adminStatusFilterSchema.parse(first(params.status) ?? null);
  const query = first(params.q) ?? "";
  const t = await getTranslations("admin");

  const entities: EntitySummary[] =
    kind === "shops"
      ? (await getAdminShops(status, query)).map((shop) => ({
          target: "shop",
          id: shop.id,
          name: shop.name,
          status: shop.status,
          area: shop.area,
          address: shop.address_line,
          ownerName: shop.owner_name,
          ownerPhone: shop.owner_phone,
          phone: shop.phone,
          reason: shop.rejection_reason,
          createdAt: shop.created_at,
          products: shop.products,
          orders30d: shop.orders_30d,
          sales30d: shop.sales_30d,
          live: shop.is_live,
          radiusM: shop.delivery_radius_m,
          allCity: shop.serves_all_city,
          hasPin: shop.lat !== null && shop.lng !== null,
          rating: shop.rating,
          ratingCount: shop.rating_count,
        }))
      : (await getAdminOrgs(status, query)).map((org) => ({
          target: "org",
          id: org.id,
          name: org.name,
          status: org.status,
          area: org.area,
          address: org.address_line,
          ownerName: org.owner_name,
          ownerPhone: org.owner_phone,
          phone: org.phone,
          reason: org.rejection_reason,
          createdAt: org.created_at,
          products: org.products,
          orders30d: org.orders_30d,
          sales30d: org.sales_30d,
          dukans30d: org.dukans_30d,
        }));

  const withDocuments = await getDocumentOwners(
    kind === "shops" ? "shop" : "org",
    entities.map((entity) => entity.id),
  );
  for (const entity of entities) entity.hasDocuments = withDocuments.has(entity.id);

  const href = (next: string | null) => {
    const search = new URLSearchParams();
    if (next) search.set("status", next);
    if (query) search.set("q", query);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };

  return (
    <AdminPageShell>
      <AdminHeader
        title={kind === "shops" ? t("directory.shopsTitle") : t("directory.orgsTitle")}
        subtitle={t("directory.count", { count: entities.length })}
      />
      <SearchBox
        label={t("directory.search")}
        placeholder={kind === "shops" ? t("directory.searchShops") : t("directory.searchOrgs")}
      />
      <LinkTabs
        label={t("directory.filter")}
        items={[
          { href: href(null), label: t("directory.all"), active: status === null },
          ...adminStatuses.map((option) => ({
            href: href(option),
            label: t(`statusPlural.${option}`),
            active: status === option,
          })),
        ]}
      />
      {entities.length === 0 ? (
        <EmptyState
          icon={kind === "shops" ? Store : Truck}
          title={t("directory.empty")}
          description={query ? t("directory.emptySearch") : undefined}
        />
      ) : (
        <ListCard label={kind === "shops" ? t("directory.shopsTitle") : t("directory.orgsTitle")}>
          <TableHead
            columns={entityColumns}
            labels={[
              kind === "shops" ? t("list.dukan") : t("list.distributor"),
              t("table.area"),
              t("table.status"),
              t("list.products"),
              t("table.orders30"),
              t("list.sales30"),
              t("table.joined"),
              "",
            ]}
          />
          {entities.map((entity) => (
            <EntityRow key={entity.id} entity={entity} canEdit />
          ))}
        </ListCard>
      )}
    </AdminPageShell>
  );
}

function DirectorySkeleton() {
  return (
    <AdminPageShell>
      <Skeleton className="h-10 w-48 rounded-md" />
      <Skeleton className="h-12 w-full rounded-md" />
      <Skeleton className="h-12 w-full rounded-full" />
      <div className="rounded-lg border border-border bg-surface px-4">
        <ListRowSkeleton />
        <ListRowSkeleton />
        <ListRowSkeleton />
      </div>
    </AdminPageShell>
  );
}

/** Every dukan (or distributor) with search, status filters and per-row actions. */
export function AdminDirectoryPage({
  kind,
  searchParams,
}: {
  kind: Kind;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<DirectorySkeleton />}>
      <DirectoryContent kind={kind} searchParams={searchParams} />
    </Suspense>
  );
}
