"use client";

import { cn } from "cn";
import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { haptic } from "@/lib/haptics";
import { useMunshi } from "./munshi-store";

const HOLD_MS = 350;

/**
 * Munshi in the mobile header: a mic with its name. Tap to open Munshi; press and hold to
 * start talking straight away.
 */
function MunshiButton({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const openMunshi = useMunshi((s) => s.openMunshi);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };

  return (
    <button
      type="button"
      aria-label={t("munshiHint")}
      className={cn(
        "relative flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary-soft ps-2.5 pe-3.5 text-sm font-semibold text-primary-strong transition-transform duration-150 select-none after:absolute after:inset-x-0 after:-inset-y-1 active:scale-95 max-[399px]:px-1.5",
        className,
      )}
      onPointerDown={() => {
        held.current = false;
        holdTimer.current = setTimeout(() => {
          held.current = true;
          haptic("tap");
          openMunshi({ listen: true });
        }, HOLD_MS);
      }}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onClick={() => {
        if (held.current) return;
        haptic("tap");
        openMunshi();
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-action text-on-action">
        <Mic aria-hidden className="size-4" />
      </span>
      {/* Narrow phones keep the mic only, so the shop name in the header stays readable. */}
      <span className="max-[399px]:hidden">{t("munshi")}</span>
    </button>
  );
}

export { MunshiButton };
