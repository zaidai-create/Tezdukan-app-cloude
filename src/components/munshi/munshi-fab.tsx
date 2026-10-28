"use client";

import { cn } from "cn";
import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMunshi } from "./munshi-store";

/** Floating Munshi button for desktop layouts (mobile has the Munshi button in its header). */
function MunshiFab({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const openMunshi = useMunshi((s) => s.openMunshi);
  return (
    <button
      type="button"
      onClick={() => openMunshi()}
      className={cn(
        "sheen fixed end-6 bottom-6 z-40 flex h-14 items-center gap-2 rounded-full bg-action ps-4 pe-5 font-semibold text-on-action shadow-glow inset-shadow-edge transition-colors hover:bg-action-hover",
        className,
      )}
    >
      <Mic aria-hidden className="size-5" />
      {t("munshi")}
    </button>
  );
}

export { MunshiFab };
