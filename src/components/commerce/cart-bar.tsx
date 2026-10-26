"use client";

import { cn } from "cn";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatRs, type Paisa } from "@/lib/money";

type CartBarProps = {
  itemCount: number;
  totalPaisa: Paisa;
  savingsPaisa?: Paisa;
  href: string;
  /** Sits above the bottom nav on mobile; set false on screens without one. */
  aboveBottomNav?: boolean;
  className?: string;
};

/**
 * Slides up after the first add and stays above the bottom nav while the cart has items:
 * item count, total, savings and "View cart".
 */
function CartBar({
  itemCount,
  totalPaisa,
  savingsPaisa = 0,
  href,
  aboveBottomNav = true,
  className,
}: CartBarProps) {
  const t = useTranslations("cart");
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {itemCount > 0 ? (
        <motion.div
          data-slot="cart-bar"
          className={cn(
            "fixed inset-x-0 z-40 mx-auto w-full max-w-xl px-3",
            aboveBottomNav
              ? "bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom)+8px)] lg:bottom-6"
              : "bottom-[calc(var(--safe-bottom)+12px)]",
            className,
          )}
          initial={{ y: 96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 96, opacity: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }
          }
        >
          <Link
            href={href}
            className="flex min-h-14 items-center gap-3 rounded-lg bg-action px-4 py-2.5 text-on-action shadow-raised transition-colors hover:bg-action-hover"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-on-action/15">
              <ShoppingBag aria-hidden className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="num text-sm font-bold">
                {t("summary", { count: itemCount, total: formatRs(totalPaisa) })}
              </span>
              {savingsPaisa > 0 ? (
                <span className="num truncate text-xs opacity-90">
                  {t("youSave", { amount: formatRs(savingsPaisa) })}
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-1 text-sm font-bold">
              {t("viewCart")}
              <ChevronRight aria-hidden className="size-5 rtl:-scale-x-100" />
            </span>
          </Link>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export { CartBar };
