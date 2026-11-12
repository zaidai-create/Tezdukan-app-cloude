"use client";

import { cn } from "cn";
import { Banknote, Bike, BellRing, PackagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { Awning } from "@/components/brand/awning";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { SpeedLines } from "@/components/brand/speed-lines";
import { PhoneFrame } from "@/components/posters/phone-frame";
import { PosterChipCard } from "@/components/posters/poster";
import { LAUNCH_AD_KEY, LAUNCH_AD_SEEN_CLASS } from "./boot";

// Long enough to read the headline, short enough not to be in the way.
const SHOW_MS = 2600;
const LEAVE_MS = 250;

const variants = {
  customer: {
    screen: "/posters/customer-home.webp",
    chips: [
      { icon: Bike, title: "onTheWay", sub: "onTheWaySub" },
      { icon: Banknote, title: "cashOnDelivery" },
    ],
  },
  business: {
    screen: "/posters/dukan-dashboard.webp",
    chips: [
      { icon: BellRing, title: "newOrder", sub: "newOrderSub" },
      { icon: PackagePlus, title: "added" },
    ],
  },
} as const;

export type LaunchAdVariant = keyof typeof variants;

const noopSubscribe = () => () => undefined;

function seenAlready(): boolean {
  const html = document.documentElement;
  if (html.classList.contains(LAUNCH_AD_SEEN_CLASS)) return true;
  const forced = location.search.includes("launchAd=1");
  try {
    return !forced && (navigator.webdriver || sessionStorage.getItem(LAUNCH_AD_KEY) !== null);
  } catch {
    return true;
  }
}

/**
 * The opening ad: TezDukan's own poster over the app while its first screen loads, once per
 * session, with Skip. It is part of the static shell, so it paints at once (on Android it
 * follows the same picture on the splash screen); a boot script hides it on reloads.
 */
export function LaunchAd({ variant }: { variant: LaunchAdVariant }) {
  const t = useTranslations("launchAd");
  const tChips = useTranslations("posters.chips");
  const [phase, setPhase] = useState<"showing" | "leaving" | "gone">("showing");
  // After hydration an ad that was already seen leaves the page entirely (the boot script only
  // hid it), so its words never sit in the page out of sight.
  const seen = useSyncExternalStore(noopSubscribe, seenAlready, () => false);
  const ad = variants[variant];

  // Before paint on a client-side arrival (e.g. right after signing in), where the boot script
  // did not run: hide it straight away if it was already seen this session.
  useLayoutEffect(() => {
    if (seenAlready()) document.documentElement.classList.add(LAUNCH_AD_SEEN_CLASS);
  }, []);

  // Marked as seen only once it has faded out, so a remount while it shows (React runs effects
  // twice in development) does not hide it early.
  const close = () => setPhase("leaving");

  useEffect(() => {
    if (document.documentElement.classList.contains(LAUNCH_AD_SEEN_CLASS)) return;
    const timer = setTimeout(close, SHOW_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(LAUNCH_AD_KEY, "1");
      } catch {
        // Storage blocked: the ad may show again next time, which is harmless.
      }
      setPhase("gone");
    }, LEAVE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "gone" || (seen && phase === "showing")) return null;

  return (
    <div
      data-launch-ad
      role="dialog"
      aria-modal="true"
      aria-label={t("label")}
      className={cn(
        "fixed inset-0 z-[70] flex flex-col overflow-hidden bg-forest text-on-forest transition-opacity duration-250 ease-out motion-reduce:transition-none",
        phase === "leaving" && "pointer-events-none opacity-0",
      )}
    >
      <Awning animated height={18} />
      <button
        type="button"
        onClick={close}
        className="absolute end-4 top-[calc(env(safe-area-inset-top)+34px)] z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-on-forest/15 px-4 text-sm font-semibold backdrop-blur"
      >
        {t("skip")}
        <X aria-hidden className="size-4" strokeWidth={2} />
      </button>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-14 pb-[calc(env(safe-area-inset-bottom)+28px)]">
        <span dir="ltr" className="flex items-center gap-2.5">
          <LogoMark variant="bare" className="h-auto w-12" />
          <Wordmark tone="onDark" className="h-7" />
        </span>
        <h1 className="mt-6 font-heading text-[2rem] leading-[1.12] font-bold text-balance">
          {t(`${variant}.title`)}
        </h1>
        <p className="mt-3 text-base text-on-forest/80">{t(`${variant}.body`)}</p>

        <div className="relative mt-6 flex min-h-0 flex-1 items-center justify-center">
          <PhoneFrame
            src={ad.screen}
            priority
            sizes="220px"
            className="[aspect-ratio:390/844] h-full max-h-[22rem] w-auto animate-rise"
          />
          <PosterChipCard
            tone="forest"
            chip={{
              icon: ad.chips[0].icon,
              title: tChips(ad.chips[0].title),
              sub: "sub" in ad.chips[0] ? tChips(ad.chips[0].sub) : undefined,
            }}
            className="absolute start-0 top-[18%] animate-float"
          />
          <PosterChipCard
            tone="forest"
            chip={{ icon: ad.chips[1].icon, title: tChips(ad.chips[1].title) }}
            className="absolute end-0 bottom-[14%] animate-float [animation-delay:1.2s]"
          />
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <SpeedLines animated tone="mint" className="w-10" />
          <span className="h-1 w-40 overflow-hidden rounded-full bg-on-forest/20" aria-hidden>
            <span className="block h-full w-full origin-left animate-[launch-progress_2.6s_linear_both] rounded-full bg-mint rtl:origin-right" />
          </span>
        </div>
      </div>
    </div>
  );
}
