"use client";

import { cn } from "cn";
import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOffline } from "next/offline";

/**
 * Shown while the app has no connection. Navigations and Server Actions wait and retry on
 * their own (experimental.useOffline); offline-capable screens (POS, khata, booker orders)
 * keep working from the local queue.
 */
function OfflineBanner({ className }: { className?: string }) {
  const offline = useOffline();
  const t = useTranslations("states");
  if (!offline) return null;
  return (
    <div
      role="status"
      data-slot="offline-banner"
      className={cn(
        "flex items-center justify-center gap-2 bg-ink px-4 py-2 text-sm font-semibold text-surface",
        className,
      )}
    >
      <WifiOff aria-hidden className="size-4" />
      <span>{t("offlineBanner")}</span>
    </div>
  );
}

export { OfflineBanner };
