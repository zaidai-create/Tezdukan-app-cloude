"use client";

import { ArrowUp } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const SHOW_AFTER_PX = 1100;

/** A small pill that appears on a long shelf and brings the shopper back to the top. */
export function BackToTop() {
  const t = useTranslations("storefront");
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const update = () => setShown(window.scrollY > SHOW_AFTER_PX);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <AnimatePresence>
      {shown ? (
        <motion.button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" })}
          className="fixed start-1/2 top-[calc(var(--safe-top,0px)+8.5rem)] z-20 flex h-10 -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink/90 px-4 text-sm font-semibold text-surface shadow-float rtl:translate-x-1/2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          <ArrowUp aria-hidden className="size-4" strokeWidth={2} />
          {t("backToTop")}
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
