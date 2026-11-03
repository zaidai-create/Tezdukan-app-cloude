"use client";

import { BellRing, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { usePushSubscription } from "../push-client";

type Audience = "dukandar" | "distributor" | "customer";

/**
 * Asks for phone notifications where they matter (new orders for a dukan or distributor,
 * order updates for a shopper), instead of leaving the switch buried in Account.
 */
export function NotificationPrompt({ audience }: { audience: Audience }) {
  const t = useTranslations("notifications");
  const { state, busy, enable } = usePushSubscription();

  if (state === "off") {
    return (
      <section className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary-soft p-4 shadow-card">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-primary-strong shadow-card">
          <BellRing aria-hidden className="size-6" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{t("prompt.title")}</span>
          <span className="block text-sm text-ink/75">{t(`prompt.hint.${audience}`)}</span>
        </span>
        <Button
          size="sm"
          loading={busy}
          onClick={async () => {
            const ok = await enable();
            haptic(ok ? "success" : "warning");
            if (ok) toast.success(t("push.enabled"));
            else toast.error(t("push.failed"));
          }}
        >
          {t("prompt.action")}
        </Button>
      </section>
    );
  }

  if (state === "blocked") {
    return (
      <section className="flex items-start gap-3 rounded-lg border border-awning/40 bg-awning-soft p-4">
        <Settings aria-hidden className="mt-0.5 size-5 shrink-0 text-awning-ink" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{t("prompt.blockedTitle")}</span>
          <span className="block text-sm text-ink/75">{t("prompt.blockedHint")}</span>
        </span>
      </section>
    );
  }

  return null;
}
