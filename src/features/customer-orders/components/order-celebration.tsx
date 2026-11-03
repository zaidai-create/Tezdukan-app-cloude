"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SpeedLines } from "@/components/brand/speed-lines";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

/**
 * Right after "Place order": a short full-screen moment (the tick lands, the speed lines run),
 * then the tracking screen underneath. Taps or three seconds close it.
 */
export function OrderCelebration({ shop, orderNumber }: { shop: string; orderNumber: string }) {
  const t = useTranslations("customerOrders.celebrate");
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    haptic("success");
    const timer = window.setTimeout(() => setOpen(false), 3200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="celebration"
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-forest px-8 text-center text-on-forest"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={() => setOpen(false)}
        >
          <motion.span
            className="flex size-28 items-center justify-center rounded-full bg-mint text-forest shadow-float"
            initial={reduceMotion ? false : { scale: 0.3, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
          >
            <Check aria-hidden className="size-14" strokeWidth={2.5} />
          </motion.span>
          <SpeedLines animated={!reduceMotion} className="w-24" />
          <div>
            <p className="font-heading text-3xl font-extrabold">{t("title")}</p>
            <p className="mt-2 text-base text-on-forest/85">{t("body", { shop })}</p>
            <p className="num mt-1 text-sm text-on-forest/70">{orderNumber}</p>
          </div>
          <Button
            size="lg"
            className="bg-mint text-forest"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
            }}
          >
            {t("track")}
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
