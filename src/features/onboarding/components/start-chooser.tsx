"use client";

import { ChevronRight, ShoppingBag, Store, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Awning } from "@/components/brand/awning";
import { Link, useRouter } from "@/i18n/navigation";
import { chooseCustomer } from "../actions";

const option =
  "flex min-h-24 w-full items-center gap-4 rounded-lg border border-border bg-surface p-4 text-start shadow-card transition-transform duration-150 ease-out active:scale-[0.98]";
const iconBox = "flex size-14 shrink-0 items-center justify-center rounded-md";

/** The first question after sign-up: dukandar, distributor or customer. */
export function StartChooser() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-canvas">
      <Awning className="text-awning" />
      <div className="flex flex-1 flex-col gap-6 px-4 pt-8 pb-10">
        <header className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold text-balance text-ink">{t("title")}</h1>
          <p className="text-base text-muted">{t("subtitle")}</p>
        </header>

        <div className="flex flex-col gap-3">
          <Link href="/start/dukan" className={option}>
            <span className={`${iconBox} bg-primary-soft text-primary-strong`}>
              <Store aria-hidden className="size-7" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-lg font-semibold text-ink">
                {t("dukan.title")}
              </span>
              <span className="block text-sm text-muted">{t("dukan.hint")}</span>
            </span>
            <ChevronRight aria-hidden className="size-5 text-muted rtl:-scale-x-100" />
          </Link>

          <Link href="/start/distributor" className={option}>
            <span className={`${iconBox} bg-awning-soft text-awning-ink`}>
              <Truck aria-hidden className="size-7" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-lg font-semibold text-ink">
                {t("distributor.title")}
              </span>
              <span className="block text-sm text-muted">{t("distributor.hint")}</span>
            </span>
            <ChevronRight aria-hidden className="size-5 text-muted rtl:-scale-x-100" />
          </Link>

          <button
            type="button"
            className={option}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const { home } = await chooseCustomer();
                router.replace(home);
              })
            }
          >
            <span className={`${iconBox} bg-subtle text-ink`}>
              <ShoppingBag aria-hidden className="size-7" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-lg font-semibold text-ink">
                {t("customer.title")}
              </span>
              <span className="block text-sm text-muted">{t("customer.hint")}</span>
            </span>
            <ChevronRight aria-hidden className="size-5 text-muted rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    </div>
  );
}
