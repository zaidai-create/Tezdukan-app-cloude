"use client";

import { cn } from "cn";
import { BellRing, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { usePushSubscription } from "../push-client";

/** "Phone notifications" card: turns Web Push on or off for this browser, honestly labelled. */
export function PushToggle({ className }: { className?: string }) {
  const t = useTranslations("notifications.push");
  const tCommon = useTranslations("common");
  const { state, busy, enable, disable } = usePushSubscription();
  if (state === "loading") return null;

  const hint =
    state === "on"
      ? t("on")
      : state === "blocked"
        ? t("blocked")
        : state === "unsupported"
          ? t("unsupported")
          : state === "sandbox"
            ? t("sandbox")
            : t("hint");

  return (
    <section
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border/70 bg-surface p-4 shadow-card",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          state === "on" ? "bg-primary-soft text-primary-strong" : "bg-subtle text-muted",
        )}
      >
        {state === "on" ? (
          <BellRing aria-hidden className="size-5" />
        ) : (
          <Smartphone aria-hidden className="size-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          {t("title")}
          {state === "sandbox" ? (
            <span className="rounded-full bg-awning-soft px-2 py-0.5 text-xs font-bold text-awning-ink">
              {tCommon("sandbox")}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-sm text-muted">{hint}</p>
      </div>
      {state === "off" ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            const ok = await enable();
            haptic(ok ? "success" : "warning");
            if (ok) toast.success(t("enabled"));
            else toast.error(t("failed"));
          }}
        >
          {t("enable")}
        </Button>
      ) : state === "on" ? (
        <Button
          size="sm"
          variant="soft"
          disabled={busy}
          onClick={async () => {
            await disable();
            toast(t("disabled"));
          }}
        >
          {t("disable")}
        </Button>
      ) : null}
    </section>
  );
}
