"use client";

import { cn } from "cn";
import { type ComponentProps, useEffect, useRef } from "react";

/**
 * The frosted bar pinned above the nav dock (the page bottom on desktop) that holds a
 * screen's main action. While it is mounted it publishes `--toast-lift`, the distance from the
 * bottom of the screen to just above itself, so toasts rise over it instead of covering the
 * button (Sonner pauses a toast under the pointer, so a covering toast would never leave).
 */
export function StickyActionBar({ className, ...props }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;
    const measure = () => {
      const bottom = Number.parseFloat(getComputedStyle(element).bottom) || 0;
      root.style.setProperty("--toast-lift", `${Math.ceil(bottom + element.offsetHeight + 12)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      root.style.removeProperty("--toast-lift");
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "material sticky bottom-[calc(var(--bottom-nav-space)+10px)] z-30 rounded-2xl p-1.5 shadow-float lg:bottom-6",
        className,
      )}
      {...props}
    />
  );
}
