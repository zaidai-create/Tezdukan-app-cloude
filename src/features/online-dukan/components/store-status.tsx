"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { setOnline } from "../actions";
import type { ShopStorefront } from "../schemas";

/** The big online / offline switch, with Undo when the dukan is switched off. */
export function StoreStatus({ store }: { store: ShopStorefront }) {
  const t = useTranslations("onlineDukan");
  const [, startTransition] = useTransition();
  const [live, setLive] = useOptimistic(store.is_live);
  const noProducts = store.visible_products === 0;

  const change = (next: boolean) =>
    startTransition(async () => {
      setLive(next);
      const result = await setOnline(next);
      if (!result.ok) {
        haptic("warning");
        toast.error(t(`errors.${result.error}`));
        return;
      }
      haptic(next ? "success" : "tap");
      if (next) {
        toast.success(t("nowOnline"));
      } else {
        toast(t("nowOffline"), {
          action: { label: t("undo"), onClick: () => change(true) },
        });
      }
    });

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 shadow-card",
        live ? "border-primary/30 bg-primary-soft" : "border-awning/40 bg-tint-amber",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "size-3 shrink-0 rounded-full",
            live ? "animate-pulse bg-primary motion-reduce:animate-none" : "bg-awning",
          )}
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-bold text-ink">
            {live ? t("liveTitle") : t("offlineTitle")}
          </h2>
          <p className="text-sm text-ink/80">
            {live ? t("liveHint") : noProducts ? t("offlineNeedsProducts") : t("offlineHint")}
          </p>
        </div>
        <Switch
          checked={live}
          onCheckedChange={change}
          disabled={!store.can_edit || (!live && noProducts)}
          aria-label={t("switchLabel")}
        />
      </div>
      <p className="num text-sm font-semibold text-ink">
        {t("products", { count: store.visible_products })}
      </p>
      {!store.can_edit ? <p className="text-sm text-muted">{t("ownerOnly")}</p> : null}
      {store.can_edit && !live && noProducts ? (
        <Link
          href="/dukan/products"
          className="sheen flex min-h-12 items-center justify-center rounded-md bg-action px-4 font-semibold text-on-action shadow-glow inset-shadow-edge"
        >
          {t("addProducts")}
        </Link>
      ) : null}
    </section>
  );
}
