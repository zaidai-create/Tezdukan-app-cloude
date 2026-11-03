"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Children, useEffect, useRef, useState } from "react";

const ADVANCE_MS = 5500;

/**
 * Posters side by side: swipe on phones (one at a time), two at a time on wide screens. It
 * moves on by itself every few seconds, but never with reduced motion or while touched.
 */
export function PosterCarousel({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTranslations("posters");
  const items = Children.toArray(children);
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
  }, [items.length]);

  const goTo = (index: number) => {
    const element = track.current;
    const target = element?.children[index] as HTMLElement | undefined;
    if (!element || !target) return;
    element.scrollTo({ left: target.offsetLeft - element.offsetLeft, behavior: "smooth" });
  };

  useEffect(() => {
    if (paused || items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      const element = track.current;
      if (!element) return;
      // On wide screens two posters show at once; wrap when the last one is in view.
      const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 8;
      goTo(atEnd ? 0 : active + 1);
    }, ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [active, paused, items.length]);

  if (items.length === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="flex flex-col gap-2.5"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        ref={track}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:scroll-px-0 lg:px-0"
      >
        {items.map((item, index) => (
          <div
            key={index}
            data-index={index}
            role="group"
            aria-roledescription="slide"
            aria-label={t("slideOf", { current: index + 1, total: items.length })}
            className="w-[calc(100%-12px)] shrink-0 snap-start lg:w-[calc(50%-6px)]"
          >
            {item}
          </div>
        ))}
      </div>
      {items.length > 1 ? (
        <div className="flex justify-center gap-1.5 lg:hidden">
          {items.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={t("slideOf", { current: index + 1, total: items.length })}
              aria-current={index === active ? "true" : undefined}
              className="relative flex h-4 items-center after:absolute after:-inset-x-1 after:-inset-y-4"
            >
              <span
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200 ease-out",
                  index === active ? "w-5 bg-primary" : "w-1.5 bg-border-strong",
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
