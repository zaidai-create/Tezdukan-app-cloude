"use client";

import { cn } from "cn";
import { ArrowRight, ShoppingBasket } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatRs, type Paisa } from "@/lib/money";

type CartBarProps = {
  itemCount: number;
  totalPaisa: Paisa;
  savingsPaisa?: Paisa;
  /** Second line, e.g. "Delivery tomorrow, 10 am to 12 pm". */
  note?: string;
  href: string;
  /** Sits above the bottom nav on mobile; set false on screens without one. */
  aboveBottomNav?: boolean;
  className?: string;
};

/**
 * Springs up after the first add and floats above the nav dock while the cart has items:
 * the item count, the total, savings or a delivery note, and a bright "View cart" pill.
 */
function CartBar({
  itemCount,
  totalPaisa,
  savingsPaisa = 0,
  note,
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
            "fixed inset-x-0 z-40 mx-auto w-full max-w-md px-4",
            aboveBottomNav
              ? "bottom-[calc(var(--bottom-nav-space)+10px)] lg:bottom-6"
              : "bottom-[calc(var(--safe-bottom)+12px)]",
            className,
          )}
          initial={{ y: 96, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 96, opacity: 0, scale: 0.96 }}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }
          }
        >
          <Link
            href={href}
            className="sheen flex min-h-16 items-center gap-3 rounded-xl bg-forest px-3 py-2.5 text-on-forest shadow-float inset-shadow-edge transition-transform duration-150 active:scale-[0.98]"
          >
            <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-on-forest/12">
              <ShoppingBasket aria-hidden className="size-5" />
              <motion.span
                key={itemCount}
                initial={reduceMotion ? false : { scale: 0.4 }}
                animate={{ scale: 1 }}
                className="num absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-awning px-1 text-[11px] leading-none font-bold text-on-awning"
              >
                {itemCount}
              </motion.span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="num truncate font-heading text-base font-bold">
                {t("summary", { count: itemCount, total: formatRs(totalPaisa) })}
              </span>
              {savingsPaisa > 0 || note ? (
                <span className="num truncate text-xs text-on-forest/80">
                  {savingsPaisa > 0 ? t("youSave", { amount: formatRs(savingsPaisa) }) : note}
                </span>
              ) : null}
            </span>
            <span className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-awning px-4 text-sm font-bold text-on-awning">
              {t("viewCart")}
              <ArrowRight aria-hidden className="size-4 rtl:-scale-x-100" />
            </span>
          </Link>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export { CartBar };
