import { ArrowLeft, MapPinned } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerLocation } from "@/features/storefront/location";
import { Link } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/auth/safe-next";
import { requireSession } from "@/lib/auth/session";
import { AddressEditor } from "./components/address-editor";
import { AddressChoices } from "./components/address-list";
import { getMyAddresses } from "./data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Hyderabad city centre: where the map opens when nothing is known about the person yet.
const HYDERABAD = { lat: 25.396, lng: 68.3578 };

function EditorSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-5" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="h-8 w-44" />
      </div>
      <Skeleton className="h-12 w-full rounded-md" />
      <Skeleton className="h-[38dvh] max-h-96 min-h-60 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-md" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-5" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="h-8 w-44" />
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-md" />
    </div>
  );
}

async function AddressesContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  await requireSession();
  const [t, params, addresses, location] = await Promise.all([
    getTranslations("addresses"),
    searchParams,
    getMyAddresses(),
    getCustomerLocation(),
  ]);
  const back = safeNextPath(first(params.next), "/account");
  // The address screens come back here, and this screen remembers where it came from.
  const here = `/addresses?${new URLSearchParams({ next: back }).toString()}`;
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-5 pb-10">
      <header className="flex items-center gap-3">
        <Link
          href={back}
          aria-label={t("back")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-card"
        >
          <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-ink">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
      </header>
      {addresses.length === 0 ? (
        <EmptyState icon={MapPinned} title={t("empty")} description={t("emptyHint")} />
      ) : null}
      <AddressChoices addresses={addresses} selectedId={location?.addressId ?? null} next={here} />
    </div>
  );
}

/** "My addresses": pick where orders go, change an address, add one. */
export function AddressesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="min-h-dvh bg-canvas">
      <Suspense fallback={<ListSkeleton />}>
        <AddressesContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function EditorContent({
  params,
  searchParams,
}: {
  params?: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await connection();
  await requireSession();
  const [query, route, addresses, location] = await Promise.all([
    searchParams,
    params,
    getMyAddresses(),
    getCustomerLocation(),
  ]);
  const next = safeNextPath(first(query.next), "/addresses");
  const address = route ? (addresses.find((candidate) => candidate.id === route.id) ?? null) : null;
  if (route && !address) {
    // Deleted on another phone, or not this person's: back to the list.
    const t = await getTranslations("addresses");
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <EmptyState
          icon={MapPinned}
          title={t("notFound")}
          action={
            <Link
              href="/addresses"
              className="inline-flex h-14 items-center justify-center rounded-md bg-action px-6 font-semibold text-on-action"
            >
              {t("title")}
            </Link>
          }
        />
      </div>
    );
  }
  const pinned = address && address.lat !== null && address.lng !== null;
  const start = pinned
    ? { lat: address.lat ?? HYDERABAD.lat, lng: address.lng ?? HYDERABAD.lng }
    : location
      ? { lat: location.lat, lng: location.lng }
      : HYDERABAD;
  return (
    <AddressEditor
      address={address}
      start={start}
      startKnown={Boolean(pinned) || location !== null}
      selected={address !== null && location?.addressId === address.id}
      next={next}
    />
  );
}

/** Add an address, or change the one in the URL. */
export function AddressEditorPage({
  params,
  searchParams,
}: {
  params?: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  return (
    <main className="min-h-dvh bg-canvas">
      <Suspense fallback={<EditorSkeleton />}>
        <EditorContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
