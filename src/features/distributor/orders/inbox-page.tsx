import { cn } from "cn";
import { Package, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ListRowSkeleton } from "@/components/states/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { first } from "@/features/ordering/listing/params";
import { Link } from "@/i18n/navigation";
import { OrderCard } from "../components/order-card";
import { getInbox, requireDistributor } from "../data";
import { inboxTabSchema, type InboxTab } from "../schemas";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function InboxSkeleton() {
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

const tabHref = (tab: InboxTab, query?: string) => {
  const params = new URLSearchParams();
  if (tab !== "new") params.set("tab", tab);
  if (query) params.set("q", query);
  const qs = params.toString();
  return qs ? `/distributor/orders?${qs}` : "/distributor/orders";
};

async function InboxContent({ searchParams }: Props) {
  await connection();
  const { orgId } = await requireDistributor("/distributor/orders");
  const params = await searchParams;
  const tab = inboxTabSchema.catch("new").parse(first(params.tab));
  const query = first(params.q)?.trim().slice(0, 80) || undefined;
  const [inbox, t] = await Promise.all([
    getInbox(orgId, tab, query),
    getTranslations("distributor.inbox"),
  ]);
  const counts: Record<InboxTab, number> = inbox.counts;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <h1 className="font-heading text-2xl font-extrabold text-ink lg:text-3xl">{t("title")}</h1>

      <form action="/distributor/orders" role="search" className="relative">
        {tab !== "new" ? <input type="hidden" name="tab" value={tab} /> : null}
        <label htmlFor="order-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
        />
        <input
          id="order-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t("searchPlaceholder")}
          className="h-12 w-full rounded-md border border-border bg-surface ps-11 pe-4 text-base text-ink shadow-card outline-none placeholder:text-muted focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
        />
      </form>

      <nav aria-label={t("title")} className="grid grid-cols-3 gap-1 rounded-full bg-subtle p-1">
        {inboxTabSchema.options.map((value) => (
          <Link
            key={value}
            href={tabHref(value, query)}
            aria-current={tab === value ? "page" : undefined}
            scroll={false}
            className={cn(
              "flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors",
              tab === value ? "bg-surface text-ink shadow-card" : "text-muted",
            )}
          >
            {t(`tabs.${value}`)}
            {counts[value] > 0 && value !== "done" ? (
              <span
                className={cn(
                  "num flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                  value === "new" ? "bg-danger text-on-danger" : "bg-subtle-strong text-ink",
                )}
              >
                {counts[value]}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {inbox.orders.length === 0 ? (
        query ? (
          <p className="py-10 text-center text-muted">{t("noResults", { query })}</p>
        ) : (
          <EmptyState
            icon={Package}
            title={t(tab === "new" ? "emptyNew" : tab === "active" ? "emptyActive" : "emptyDone")}
            description={t("emptyHint")}
          />
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {inbox.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** The distributor's order inbox: new (big orders needing a call first), in progress, done. */
export function InboxPage(props: Props) {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxContent {...props} />
    </Suspense>
  );
}
