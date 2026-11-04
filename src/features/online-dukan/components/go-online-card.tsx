"use client";

import { Loader2, PackagePlus, Power, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { setOnline } from "../actions";

const action =
  "sheen flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-action px-4 font-semibold text-on-action shadow-glow inset-shadow-edge transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-70";

/**
 * Shown while the dukan is offline: says plainly that customers cannot order and goes online
 * in one tap (or points to Products when there is nothing to sell yet).
 */
export function GoOnlineCard({ hasProducts }: { hasProducts: boolean }) {
  const t = useTranslations("onlineDukan");
  const [pending, startTransition] = useTransition();
  const [needsProducts, setNeedsProducts] = useState(!hasProducts);

  const goOnline = () =>
    startTransition(async () => {
      const result = await setOnline(true);
      if (result.ok) {
        haptic("success");
        toast.success(t("nowOnline"));
        return;
      }
      if (result.error === "no_products") setNeedsProducts(true);
      haptic("warning");
      toast.error(t(`errors.${result.error}`));
    });

  return (
    <section
      aria-labelledby="go-online-title"
      className="flex flex-col gap-3 rounded-xl border border-awning/40 bg-tint-amber p-4 shadow-card"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-awning-soft text-awning-ink">
          <Store aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 id="go-online-title" className="font-heading text-lg font-bold text-ink">
            {t("offlineTitle")}
          </h2>
          <p className="text-sm text-ink/80">
            {needsProducts ? t("offlineNeedsProducts") : t("offlineHint")}
          </p>
        </div>
      </div>
      {needsProducts ? (
        <Link href="/dukan/products" className={action}>
          <PackagePlus aria-hidden className="size-5" strokeWidth={1.75} />
          {t("addProducts")}
        </Link>
      ) : (
        <button type="button" onClick={goOnline} disabled={pending} className={action}>
          {pending ? (
            <Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
          ) : (
            <Power aria-hidden className="size-5" strokeWidth={1.75} />
          )}
          {t("goOnline")}
        </button>
      )}
    </section>
  );
}
