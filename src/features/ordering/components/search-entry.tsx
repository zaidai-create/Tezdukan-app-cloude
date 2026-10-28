"use client";

import { cn } from "cn";
import { Mic, Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useMunshi } from "@/components/munshi/munshi-store";
import { Link } from "@/i18n/navigation";

const EXAMPLES = ["Tapal Danedar", "Dalda 5 L", "Surf Excel", "Olper's", "Shan Biryani"];

/**
 * The home search bar: opens the search screen, cycles through example products so a new
 * dukandar sees what to type, and has Munshi's mic for asking by voice.
 */
function SearchEntry({ className }: { className?: string }) {
  const t = useTranslations("ordering");
  const reduceMotion = useReducedMotion();
  const openMunshi = useMunshi((s) => s.openMunshi);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % EXAMPLES.length), 2600);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  return (
    <div
      className={cn(
        "flex h-14 items-center gap-1 rounded-full border border-border/80 bg-surface ps-1.5 pe-1.5 shadow-card",
        className,
      )}
    >
      <Link
        href="/dukan/search"
        prefetch
        className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-full ps-3 text-muted"
      >
        <span className="sr-only">{t("searchHint")}</span>
        <Search aria-hidden className="size-5 shrink-0 text-ink" />
        <span aria-hidden className="relative h-6 min-w-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={index}
              className="absolute inset-0 truncate text-base"
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -18, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {t("searchFor", { name: EXAMPLES[index] ?? "" })}
            </motion.span>
          </AnimatePresence>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => openMunshi({ listen: true })}
        aria-label={t("askMunshi")}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong transition-transform active:scale-95"
      >
        <Mic aria-hidden className="size-5" />
      </button>
    </div>
  );
}

export { SearchEntry };
