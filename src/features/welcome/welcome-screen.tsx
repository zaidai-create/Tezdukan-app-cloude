"use client";

import { cn } from "cn";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Awning } from "@/components/brand/awning";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { SpeedLines } from "@/components/brand/speed-lines";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { WELCOMED_COOKIE } from "@/lib/auth/roles";
import { haptic } from "@/lib/haptics";

const slides = [
  { key: "doorstep", image: "/welcome/doorstep.webp" },
  { key: "distributors", image: "/welcome/distributors.webp" },
  { key: "products", image: "/welcome/products.webp" },
] as const;

function rememberWelcome() {
  document.cookie = `${WELCOMED_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
}

const SPLASH_MS = 1400;
const SWIPE = 60;

/**
 * First launch: a short splash (the logo on the signboard, speed lines running), then three
 * posters about what TezDukan does, then sign-up or sign-in. Shown once per device.
 */
export function WelcomeScreen() {
  const t = useTranslations("welcome");
  const reduceMotion = useReducedMotion();
  const [splash, setSplash] = useState(true);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const last = index === slides.length - 1;
  const slide = slides[index] ?? slides[0];

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), reduceMotion ? 300 : SPLASH_MS);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  const go = (next: number) => {
    if (next < 0 || next >= slides.length) return;
    haptic("tap");
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-canvas">
      <AnimatePresence>
        {splash ? (
          <motion.div
            key="splash"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-brand-panel text-on-brand-panel"
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 1.04 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div data-logo-reveal className="flex flex-col items-center gap-4">
              <LogoMark variant="bare" className="h-auto w-36" />
              <Wordmark data-part="wordmark" tone="onDark" className="h-10" />
            </div>
            <SpeedLines animated tone="mint" className="w-14" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <header className="pt-safe flex items-center justify-between px-5 pt-4">
        <span dir="ltr" className="flex items-center gap-2">
          <LogoMark className="size-9" />
          <Wordmark className="h-5" />
        </span>
        <Link
          href="/login"
          onClick={rememberWelcome}
          className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-muted hover:text-ink"
        >
          {t("skip")}
        </Link>
      </header>

      <main className="flex flex-1 flex-col px-5 pt-4 pb-6">
        <h1 className="sr-only">{t("title")}</h1>
        <div className="relative flex-1">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.section
              key={slide.key}
              custom={direction}
              aria-roledescription="slide"
              aria-label={t("slideOf", { current: index + 1, total: slides.length })}
              className="flex h-full flex-col gap-6"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -60 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={(_, info) => {
                // Swipe towards the start of the line to go forward, in either script.
                const rtl = document.documentElement.dir === "rtl";
                const forward = rtl ? info.offset.x > SWIPE : info.offset.x < -SWIPE;
                const back = rtl ? info.offset.x < -SWIPE : info.offset.x > SWIPE;
                if (forward) go(index + 1);
                else if (back) go(index - 1);
              }}
            >
              <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-surface shadow-raised">
                <Awning height={14} stripe={18} className="absolute inset-x-0 top-0 z-10" />
                <div className="relative aspect-[4/3.2] w-full">
                  <Image
                    src={slide.image}
                    alt={t(`slides.${slide.key}.alt`)}
                    fill
                    priority={index === 0}
                    sizes="(min-width: 640px) 448px, 100vw"
                    className="object-cover"
                    draggable={false}
                  />
                </div>
              </div>
              <div className="mx-auto w-full max-w-md">
                <p className="mb-2 flex items-center gap-2">
                  <SpeedLines tone="primary" className="w-6" />
                </p>
                <h2 className="font-heading text-[30px] leading-[1.15] font-extrabold text-ink">
                  {t(`slides.${slide.key}.title`)}
                </h2>
                <p className="mt-3 text-base text-muted">{t(`slides.${slide.key}.body`)}</p>
              </div>
            </motion.section>
          </AnimatePresence>
        </div>

        <div className="mx-auto mt-6 flex w-full max-w-md flex-col gap-4">
          <div className="flex justify-center gap-2" role="group" aria-label={t("title")}>
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => go(i)}
                aria-current={i === index ? "step" : undefined}
                aria-label={t("slideOf", { current: i + 1, total: slides.length })}
                className="relative flex h-6 items-center after:absolute after:-inset-x-1.5 after:-inset-y-3"
              >
                <span
                  className={cn(
                    "block h-2 rounded-full transition-all duration-200",
                    i === index ? "w-7 bg-action" : "w-2 bg-border-strong/50",
                  )}
                />
              </button>
            ))}
          </div>
          {last ? (
            <>
              <Link
                href="/signup"
                onClick={rememberWelcome}
                className={buttonVariants({ size: "lg", block: true })}
              >
                {t("getStarted")}
                <ArrowRight aria-hidden className="rtl:-scale-x-100" />
              </Link>
              <Link
                href="/login"
                onClick={rememberWelcome}
                className={buttonVariants({ size: "lg", block: true, variant: "soft" })}
              >
                {t("haveAccount")}
              </Link>
            </>
          ) : (
            <Button size="lg" block onClick={() => go(index + 1)}>
              {t("next")}
              <ArrowRight aria-hidden className="rtl:-scale-x-100" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
