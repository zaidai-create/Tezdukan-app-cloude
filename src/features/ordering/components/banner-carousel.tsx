"use client";

import { cn } from "cn";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { storageUrl } from "../images";
import type { Banner } from "../schemas";

/**
 * Offer banners as deep-green cards with the artwork on the end side. Scroll-snaps by hand
 * and advances on its own every few seconds (not with reduced motion, not while touched).
 */
function BannerCarousel({ banners }: { banners: Banner[] }) {
  const t = useTranslations("ordering");
  const locale = useLocale();
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { root: element, threshold: 0.6 },
    );
    for (const child of element.children) observer.observe(child);
    return () => observer.disconnect();
  }, [banners.length]);

  useEffect(() => {
    if (paused || banners.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      const element = track.current;
      const next = element?.children[(active + 1) % banners.length] as HTMLElement | undefined;
      next?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    }, 5000);
    return () => clearInterval(timer);
  }, [active, paused, banners.length]);

  if (banners.length === 0) return null;
  const urdu = locale === "ur" || locale === "sd";

  return (
    <section aria-roledescription="carousel" className="flex flex-col gap-2">
      <div
        ref={track}
        onPointerDown={() => setPaused(true)}
        className="flex snap-x snap-mandatory scroll-px-4 scrollbar-none gap-3 overflow-x-auto px-4"
      >
        {banners.map((banner, index) => (
          <Link
            key={banner.id}
            data-index={index}
            href={banner.link ?? "/dukan"}
            aria-roledescription="slide"
            className="sheen relative flex min-h-40 w-[88%] max-w-xl shrink-0 snap-start overflow-hidden rounded-xl bg-forest text-on-forest shadow-raised inset-shadow-edge sm:w-[70%]"
          >
            <div className="relative z-10 flex w-[58%] flex-col justify-between gap-3 p-4">
              <div>
                <p className="font-heading text-xl leading-tight font-bold">
                  {urdu ? (banner.title_ur ?? banner.title) : banner.title}
                </p>
                {banner.subtitle && !urdu ? (
                  <p className="mt-1 line-clamp-2 text-sm text-on-forest/80">{banner.subtitle}</p>
                ) : null}
              </div>
              <span className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-awning px-3.5 text-sm font-bold text-on-awning">
                {t("bannerCta")}
                <ArrowRight aria-hidden className="size-4 rtl:-scale-x-100" />
              </span>
            </div>
            <div className="absolute inset-y-0 end-0 w-[52%]">
              <Image
                src={storageUrl(banner.image_path) ?? ""}
                alt=""
                fill
                sizes="(min-width: 640px) 360px, 50vw"
                priority={index === 0}
                className="object-cover"
              />
              {/* Fade the photo into the card so the text side stays readable. */}
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(90deg,var(--forest)_0%,transparent_45%)] rtl:bg-[linear-gradient(270deg,var(--forest)_0%,transparent_45%)]"
              />
            </div>
          </Link>
        ))}
      </div>
      {banners.length > 1 ? (
        <div className="flex justify-center gap-1.5" aria-hidden>
          {banners.map((banner, index) => (
            <span
              key={banner.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                index === active ? "w-5 bg-primary" : "w-1.5 bg-border-strong/40",
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export { BannerCarousel };
