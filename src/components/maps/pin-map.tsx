"use client";

import "leaflet/dist/leaflet.css";
import { cn } from "cn";
import type { Map as LeafletMap } from "leaflet";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { publicEnv } from "@/lib/env";

export type MapPoint = { lat: number; lng: number };
export type PinMapHandle = {
  /**
   * Centres the map (and so the pin) on a point, zooming in to street level if needed.
   * False when the map has not loaded yet, so the caller can carry on without it.
   */
  moveTo: (point: MapPoint) => boolean;
};

const STREET_ZOOM = 17;

// OpenStreetMap asks for a link to its copyright page wherever its tiles are shown.
const attribution = publicEnv.NEXT_PUBLIC_MAP_TILE_URL.includes("openstreetmap.org")
  ? `<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">${publicEnv.NEXT_PUBLIC_MAP_ATTRIBUTION}</a>`
  : publicEnv.NEXT_PUBLIC_MAP_ATTRIBUTION;

/**
 * A map with the pin fixed in the middle: the person slides the map under it until the pin
 * sits on their door, the way delivery apps do it. That is more exact than tapping, and the
 * pin is never under a thumb. Leaflet loads only when a screen with a map opens.
 */
export function PinMap({
  ref,
  initial,
  initialZoom = STREET_ZOOM,
  onSettle,
  onMoveStart,
  label,
  className,
  children,
}: {
  ref?: Ref<PinMapHandle>;
  initial: MapPoint;
  initialZoom?: number;
  /** Where the pin is once the map stops moving. */
  onSettle: (point: MapPoint) => void;
  onMoveStart?: () => void;
  /** What the map is for, read to screen-reader users. */
  label: string;
  className?: string;
  /** Extra controls drawn over the map. */
  children?: ReactNode;
}) {
  const t = useTranslations("map");
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [ready, setReady] = useState(false);
  const [moving, setMoving] = useState(false);
  // The map is created once; later renders must not rebuild it, so these live in refs.
  const start = useRef({ initial, initialZoom });
  const handlers = useRef({ onSettle, onMoveStart });
  useEffect(() => {
    handlers.current = { onSettle, onMoveStart };
  }, [onSettle, onMoveStart]);

  useEffect(() => {
    let cancelled = false;
    let created: LeafletMap | null = null;
    let observer: ResizeObserver | null = null;
    void (async () => {
      const leaflet = await import("leaflet");
      const element = container.current;
      if (cancelled || !element) return;
      created = leaflet.map(element, {
        center: [start.current.initial.lat, start.current.initial.lng],
        zoom: start.current.initialZoom,
        minZoom: 6,
        maxZoom: 19,
        zoomControl: false,
      });
      // Leaflet's default credit carries a flag emoji; the map data's credit is what matters.
      created.attributionControl.setPrefix(false);
      leaflet
        .tileLayer(publicEnv.NEXT_PUBLIC_MAP_TILE_URL, {
          attribution,
          maxZoom: 19,
          // Sharper streets on phone screens.
          detectRetina: true,
          // Tiles fetched with CORS can be cached by the service worker.
          crossOrigin: true,
        })
        .addTo(created);
      created.on("movestart", () => {
        setMoving(true);
        handlers.current.onMoveStart?.();
      });
      created.on("moveend", () => {
        setMoving(false);
        const centre = created?.getCenter();
        if (centre) handlers.current.onSettle({ lat: centre.lat, lng: centre.lng });
      });
      // The keyboard opening or the screen turning changes the map's box.
      observer = new ResizeObserver(() => created?.invalidateSize());
      observer.observe(element);
      map.current = created;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      created?.remove();
      map.current = null;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      moveTo: (point) => {
        const current = map.current;
        if (!current) return false;
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        current.setView([point.lat, point.lng], Math.max(current.getZoom(), STREET_ZOOM), {
          animate: !calm,
        });
        return true;
      },
    }),
    [],
  );

  return (
    // isolate: Leaflet's own layers use large z-indexes, which must stay inside the map.
    <div
      dir="ltr"
      data-ready={ready}
      className={cn(
        "group relative isolate overflow-hidden rounded-xl border border-border/70 bg-subtle",
        className,
      )}
    >
      {/* Leaflet adds its own classes to this element. React rewrites the whole class
          attribute whenever its own list changes, which would wipe them, so this list never
          changes: the fade-in hangs off the wrapper's data-ready instead. */}
      <div
        ref={container}
        role="application"
        aria-label={label}
        className={cn(
          "size-full bg-subtle font-sans opacity-0 transition-opacity duration-200 ease-out outline-none group-data-[ready=true]:opacity-100 motion-reduce:transition-none",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
          "[&_.leaflet-control-attribution]:rounded-ss-md [&_.leaflet-control-attribution]:bg-surface/85 [&_.leaflet-control-attribution]:px-1.5 [&_.leaflet-control-attribution]:text-xs [&_.leaflet-control-attribution]:text-muted",
          "[&_.leaflet-control-attribution_a]:text-ink",
        )}
      />

      {/* The pin: its tip marks the exact spot. It lifts while the map moves. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[450] flex items-center justify-center"
      >
        <div className="relative -translate-y-1/2">
          <svg
            viewBox="0 0 40 52"
            className={cn(
              "h-13 w-10 drop-shadow-md transition-transform duration-150 ease-out motion-reduce:transition-none",
              moving ? "-translate-y-2" : "translate-y-0",
            )}
          >
            <path
              d="M20 1.5C9.8 1.5 1.5 9.7 1.5 19.8c0 13.4 16 28.6 17.4 30 .6.6 1.6.6 2.2 0 1.4-1.4 17.4-16.6 17.4-30C38.5 9.7 30.2 1.5 20 1.5Z"
              fill="var(--awning)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
            <circle cx="20" cy="19.5" r="6.5" fill="var(--surface)" />
          </svg>
          <span
            className={cn(
              "absolute start-1/2 -bottom-1 h-1.5 w-4 -translate-x-1/2 rounded-full bg-ink/30 transition-transform duration-150 ease-out motion-reduce:transition-none",
              moving ? "scale-75" : "scale-100",
            )}
          />
        </div>
      </div>

      <div className="absolute end-3 top-3 z-[1000] flex flex-col overflow-hidden rounded-full border border-border/70 bg-surface shadow-raised">
        <button
          type="button"
          aria-label={t("zoomIn")}
          onClick={() => map.current?.zoomIn()}
          className="flex size-12 items-center justify-center text-ink active:bg-subtle"
        >
          <Plus aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
        <span aria-hidden className="mx-2 h-px bg-border" />
        <button
          type="button"
          aria-label={t("zoomOut")}
          onClick={() => map.current?.zoomOut()}
          className="flex size-12 items-center justify-center text-ink active:bg-subtle"
        >
          <Minus aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
      </div>

      {children ? <div className="absolute inset-x-3 top-3 z-[1000] me-16">{children}</div> : null}
    </div>
  );
}
