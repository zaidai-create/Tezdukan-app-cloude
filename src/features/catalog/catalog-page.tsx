import { cn } from "cn";
import { Boxes, Plus, Search } from "lucide-react";
import Form from "next/form";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProductImage } from "@/components/commerce/product-image";
import { EmptyState } from "@/components/states/empty-state";
import { ListRowSkeleton } from "@/components/states/skeletons";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireDistributor } from "@/features/distributor/data";
import { storageUrl } from "@/features/ordering/images";
import { first } from "@/features/ordering/listing/params";
import { Link } from "@/i18n/navigation";
import { formatRs } from "@/lib/money";
import { ActiveSwitch } from "./components/active-switch";
import { OrgStarterPack } from "./components/org-starter-pack";
import { getCatalogReference, getCatalogProduct, getOrgCatalog, getOrgStarterPack } from "./data";
import { ProductForm } from "./components/product-form";
import { catalogFilterSchema, type CatalogFilter } from "./schemas";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function CatalogSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-12 w-full rounded-md" />
      <Skeleton className="h-11 w-full rounded-full" />
      <div className="rounded-lg border border-border bg-surface px-4">
        <ListRowSkeleton />
        <ListRowSkeleton />
        <ListRowSkeleton />
      </div>
    </div>
  );
}

const filterHref = (filter: CatalogFilter, query?: string) => {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (query) params.set("q", query);
  const qs = params.toString();
  return qs ? `/distributor/catalog?${qs}` : "/distributor/catalog";
};

async function CatalogContent({ searchParams }: Props) {
  await connection();
  const { orgId } = await requireDistributor("/distributor/catalog");
  const params = await searchParams;
  const filter = catalogFilterSchema.catch("all").parse(first(params.filter));
  const query = first(params.q)?.trim().slice(0, 80) || undefined;
  const [catalog, t, starter] = await Promise.all([
    getOrgCatalog(orgId, filter, query),
    getTranslations("catalog"),
    getOrgStarterPack(orgId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-extrabold text-ink lg:text-3xl">{t("title")}</h1>
        <Link href="/distributor/catalog/new" className={buttonVariants({ size: "sm" })}>
          <Plus aria-hidden />
          {t("add")}
        </Link>
      </div>

      {starter.length > 0 && filter === "all" && !query ? (
        <OrgStarterPack items={starter} defaultOpen={catalog.counts.all < 12} />
      ) : null}

      <Form action="/distributor/catalog" role="search" className="relative">
        {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
        <label htmlFor="catalog-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
        />
        <input
          id="catalog-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t("searchPlaceholder")}
          className="h-12 w-full rounded-md border border-border bg-surface ps-11 pe-4 text-base text-ink shadow-card outline-none placeholder:text-muted focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
        />
      </Form>

      <nav
        aria-label={t("title")}
        className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1"
      >
        {catalogFilterSchema.options.map((value) => (
          <Link
            key={value}
            href={filterHref(value, query)}
            aria-current={filter === value ? "page" : undefined}
            scroll={false}
            className={cn(
              "num relative flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors after:absolute after:inset-x-0 after:-inset-y-1",
              filter === value
                ? "border-primary bg-primary-soft text-primary-strong"
                : "border-border bg-surface text-ink",
            )}
          >
            {t(`filters.${value}`)}
            <span className="text-xs opacity-80">{catalog.counts[value]}</span>
          </Link>
        ))}
      </nav>

      {catalog.items.length === 0 ? (
        query ? (
          <p className="py-10 text-center text-muted">{t("noResults", { query })}</p>
        ) : (
          <EmptyState
            icon={Boxes}
            title={t("empty")}
            description={t("emptyHint")}
            action={
              <Link href="/distributor/catalog/new" className={buttonVariants({ size: "lg" })}>
                <Plus aria-hidden />
                {t("add")}
              </Link>
            }
          />
        )
      ) : (
        <ul className="flex flex-col divide-y divide-border/70 rounded-lg border border-border/70 bg-surface shadow-card">
          {catalog.items.map((item) => {
            const margin =
              item.mrp_paisa > 0
                ? Math.round(((item.mrp_paisa - item.trade_price_paisa) / item.mrp_paisa) * 1000) /
                  10
                : null;
            return (
              <li key={item.id} className="flex items-center gap-3 p-3">
                <Link
                  href={`/distributor/catalog/${item.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <ProductImage
                    src={storageUrl(item.image_path)}
                    alt={item.name}
                    sizes="56px"
                    className={cn("size-14 shrink-0 rounded-md", !item.is_active && "opacity-50")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-semibold text-pretty text-ink">
                      {item.name}
                    </span>
                    <span className="num block text-sm text-ink">
                      {t("perPiece", { price: formatRs(item.trade_price_paisa) })}
                      {margin !== null ? (
                        <span className="text-muted"> · {t("margin", { percent: margin })}</span>
                      ) : null}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {!item.is_active ? (
                        <StatusBadge tone="neutral">{t("hidden")}</StatusBadge>
                      ) : item.available_base_qty === null ? (
                        <StatusBadge tone="neutral" icon={null}>
                          {t("notTracked")}
                        </StatusBadge>
                      ) : item.available_base_qty > 0 ? (
                        <StatusBadge tone="success">
                          {t("inStock", { count: item.available_base_qty })}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="danger">{t("outOfStock")}</StatusBadge>
                      )}
                    </span>
                  </span>
                </Link>
                <ActiveSwitch id={item.id} name={item.name} active={item.is_active} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The distributor's catalog: search, filters, stock at a glance, show/hide in one tap. */
export function CatalogPage(props: Props) {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <CatalogContent {...props} />
    </Suspense>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

async function ProductFormContent({ params }: { params?: Promise<{ id: string }> }) {
  await connection();
  const id = params ? (await params).id : undefined;
  const { orgId } = await requireDistributor(
    id ? `/distributor/catalog/${id}` : "/distributor/catalog/new",
  );
  const [reference, product] = await Promise.all([
    getCatalogReference(),
    id ? getCatalogProduct(orgId, id) : Promise.resolve(undefined),
  ]);
  return <ProductForm orgId={orgId} product={product} reference={reference} />;
}

/** Add (no params) or edit (with the product id) a product. */
export function ProductFormPage(props: { params?: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <ProductFormContent {...props} />
    </Suspense>
  );
}
