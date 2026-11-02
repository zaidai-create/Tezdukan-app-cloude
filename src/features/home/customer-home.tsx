import { ChevronRight, MessageSquareShare, Phone, Store, Truck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { Awning } from "@/components/brand/awning";
import { EmptyState } from "@/components/states/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getNearbyDukans } from "@/features/onboarding/data";
import { storageUrl } from "@/features/ordering/images";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { telHref, whatsappHref } from "@/lib/contact";

function CustomerHomeSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6" aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  );
}

const contactButton =
  "flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong";

async function CustomerHomeContent() {
  await connection();
  const session = await requireRole("customer", "/");
  const [t, locale, dukans] = await Promise.all([
    getTranslations(),
    getLocale(),
    getNearbyDukans(),
  ]);
  const firstName = session.fullName.split(" ")[0] ?? "";
  const hasBusiness = session.contexts.some(
    (context) => context.role === "dukandar" || context.role === "distributor",
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-ink lg:text-3xl">
          {firstName ? t("home.greetingNamed", { name: firstName }) : t("home.greeting")}
        </h1>
        <p className="mt-1 text-base text-muted">{t("home.subtitle.customer")}</p>
      </header>

      {hasBusiness ? null : (
        <section className="overflow-hidden rounded-xl bg-forest text-on-forest shadow-raised">
          <Awning className="text-awning" height={16} />
          <div className="flex flex-col gap-3 p-5">
            <Store aria-hidden className="size-8 text-mint" strokeWidth={1.75} />
            <h2 className="font-heading text-xl font-bold">{t("customerHome.registerTitle")}</h2>
            <p className="text-sm text-on-forest/80">{t("customerHome.registerHint")}</p>
            <Link
              href="/start/dukan"
              className="sheen mt-1 inline-flex h-12 items-center justify-center gap-2 self-start rounded-md bg-action px-5 font-semibold text-on-action shadow-glow inset-shadow-edge"
            >
              {t("customerHome.registerAction")}
              <ChevronRight aria-hidden className="size-5 rtl:-scale-x-100" />
            </Link>
          </div>
        </section>
      )}

      {hasBusiness ? null : (
        <Link
          href="/start/distributor"
          className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-card"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-awning-soft text-awning-ink">
            <Truck aria-hidden className="size-6" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">
              {t("customerHome.distributorTitle")}
            </span>
            <span className="block text-sm text-muted">{t("customerHome.distributorAction")}</span>
          </span>
          <ChevronRight aria-hidden className="size-5 text-muted rtl:-scale-x-100" />
        </Link>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold text-ink">
          {t("customerHome.nearbyTitle")}
        </h2>
        {dukans.length === 0 ? (
          <EmptyState
            icon={Store}
            title={t("customerHome.nearbyEmpty")}
            description={t("customerHome.nearbyEmptyHint")}
          />
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface shadow-card">
              {dukans.map((dukan) => {
                const tel = telHref(dukan.phone);
                const wa = whatsappHref(dukan.whatsapp ?? dukan.phone);
                const area =
                  locale === "ur" && dukan.area_name_ur ? dukan.area_name_ur : dukan.area_name;
                return (
                  <li key={dukan.id} className="flex items-center gap-3 p-3">
                    <Avatar className="size-14 rounded-md">
                      {dukan.photo_path ? (
                        <AvatarImage
                          src={storageUrl(dukan.photo_path, "shop-media") ?? undefined}
                          alt=""
                        />
                      ) : null}
                      <AvatarFallback name={dukan.name} className="rounded-md text-base" />
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{dukan.name}</p>
                      <p className="truncate text-sm text-muted">
                        {[area, dukan.address_line].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {tel ? (
                      <a
                        href={tel}
                        className={contactButton}
                        aria-label={`${t("customerHome.call")}: ${dukan.name}`}
                      >
                        <Phone aria-hidden className="size-5" />
                      </a>
                    ) : null}
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={contactButton}
                        aria-label={`${t("customerHome.whatsapp")}: ${dukan.name}`}
                      >
                        <MessageSquareShare aria-hidden className="size-5" />
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted">{t("customerHome.orderingSoon")}</p>
          </>
        )}
      </section>
    </div>
  );
}

/** The shopper's home: nearby dukans, and the way in for dukandars and distributors. */
export function CustomerHome() {
  return (
    <Suspense fallback={<CustomerHomeSkeleton />}>
      <CustomerHomeContent />
    </Suspense>
  );
}
