"use client";

import { cn } from "cn";
import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { haptic } from "@/lib/haptics";

type AddToCartProps = {
  quantity: number;
  onQuantityChange: (next: number) => void;
  /** Product name for screen-reader labels ("Add Tapal Danedar"). */
  productName: string;
  /** Smallest quantity to add on the first tap (MOQ in the selected unit). */
  minQuantity?: number;
  step?: number;
  max?: number;
  disabled?: boolean;
  size?: "md" | "lg";
  className?: string;
};

const spring = { type: "spring", stiffness: 520, damping: 32, mass: 0.7 } as const;

/**
 * The green outlined ADD button that morphs into a − qty + stepper. Width is fixed so the
 * card never reflows; the morph is a spring on the background and a crossfade of the content.
 */
function AddToCart({
  quantity,
  onQuantityChange,
  productName,
  minQuantity = 1,
  step = 1,
  max,
  disabled = false,
  size = "md",
  className,
}: AddToCartProps) {
  const t = useTranslations("product");
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : spring;
  const added = quantity > 0;
  const atMax = max !== undefined && quantity + step > max;

  const change = (next: number) => {
    haptic("tap");
    onQuantityChange(next < minQuantity ? 0 : next);
  };

  return (
    <motion.div
      data-slot="add-to-cart"
      data-state={added ? "added" : "empty"}
      className={cn(
        "relative isolate inline-flex shrink-0 items-stretch overflow-hidden rounded-md",
        size === "md" ? "h-9 w-[84px]" : "h-12 w-32",
        "after:absolute after:inset-x-0 after:-inset-y-1.5 after:-z-10",
        className,
      )}
      initial={false}
      animate={{
        backgroundColor: added ? "var(--action)" : "var(--surface)",
        borderColor: added ? "var(--action)" : "var(--primary)",
      }}
      transition={transition}
      style={{ borderWidth: 1.5, borderStyle: "solid" }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {added ? (
          <motion.div
            key="stepper"
            className="flex w-full items-center justify-between text-on-action"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={transition}
          >
            <button
              type="button"
              className="flex h-full flex-1 items-center justify-center transition-opacity active:opacity-70"
              aria-label={t("decrease", { name: productName })}
              disabled={disabled}
              onClick={() => change(quantity - step)}
            >
              <Minus className="size-4 stroke-[2.5]" />
            </button>
            <span
              className={cn(
                "num min-w-6 text-center font-bold",
                size === "md" ? "text-sm" : "text-lg",
              )}
              aria-live="polite"
              aria-label={t("quantityInCart", { count: quantity })}
            >
              {quantity}
            </span>
            <button
              type="button"
              className="flex h-full flex-1 items-center justify-center transition-opacity active:opacity-70 disabled:opacity-40"
              aria-label={t("increase", { name: productName })}
              disabled={disabled || atMax}
              onClick={() => change(quantity + step)}
            >
              <Plus className="size-4 stroke-[2.5]" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="add"
            type="button"
            className={cn(
              "flex w-full items-center justify-center gap-1 font-bold tracking-wide text-primary-strong disabled:opacity-50",
              size === "md" ? "text-sm" : "text-base",
            )}
            aria-label={t("addNamed", { name: productName })}
            disabled={disabled}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={transition}
            onClick={() => change(Math.max(minQuantity, step))}
          >
            {t("add")}
            <Plus aria-hidden className="size-3.5 stroke-[2.5]" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export { AddToCart };
