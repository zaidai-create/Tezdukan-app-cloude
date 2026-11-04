import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireDukan } from "@/features/ordering/data";
import { Link } from "@/i18n/navigation";
import { ShareCard } from "./components/share-card";
import { StoreStatus } from "./components/store-status";
import { StorefrontForm } from "./components/storefront-form";
import { getShopStorefront } from "./data";

function OnlineDukanSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-5" aria-hidden>
      <Skeleton className="h-12 w-48 rounded-md" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}

/** The dukan's public link, built from this request so it is right on every deployment. */
async function shopUrl(slug: string): Promise<string> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "tezdukan.vercel.app";
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/shops/${slug}`;
}

async function OnlineDukanContent() {
  await connection();
  const { shopId } = await requireDukan("/dukan/store");
  const [t, store] = await Promise.all([getTranslations("onlineDukan"), getShopStorefront(shopId)]);
  const url = await shopUrl(store.slug);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-5">
      <header className="flex items-center gap-3">
        <Link
          href="/dukan"
          aria-label={t("back")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-card"
        >
          <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
        </Link>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-ink">{t("title")}</h1>
          <p className="truncate text-sm text-muted">{t("subtitle")}</p>
        </div>
      </header>
      <StoreStatus store={store} />
      {store.is_live ? <ShareCard url={url} name={store.name} /> : null}
      <StorefrontForm store={store} />
    </div>
  );
}

/** Online dukan: the switch for online orders, the dukan's link, and the delivery terms. */
export function OnlineDukanPage() {
  return (
    <Suspense fallback={<OnlineDukanSkeleton />}>
      <OnlineDukanContent />
    </Suspense>
  );
}
