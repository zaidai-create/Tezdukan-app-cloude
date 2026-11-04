"use client";

import { useRef, useState } from "react";
import type * as React from "react";
import { cn } from "cn";

export type ChartBar = {
  key: string;
  /** Full label for the readout and screen readers: "6 pm – 9 pm", "Mon · 03/11/2026". */
  label: string;
  /** Axis tick under the bar; empty to leave the tick out. */
  tick: string;
  value: number;
  valueLabel: string;
  ordersLabel: string;
};

type SalesChartProps = {
  bars: ChartBar[];
  /** The bar picked at first: the busiest one, or the latest when nothing sold. */
  initialIndex: number;
  peakIndex: number;
  label: string;
  tableCaption: string;
  columnLabel: string;
  valueColumn: string;
};

/**
 * One-series bar chart. Tap, drag or use the arrow keys to read any bar; the readout above the
 * bars shows its value, so the bars themselves never need a number on them.
 */
export function SalesChart({
  bars,
  initialIndex,
  peakIndex,
  label,
  tableCaption,
  columnLabel,
  valueColumn,
}: SalesChartProps) {
  const [selected, setSelected] = useState(initialIndex);
  const plot = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  const current = bars[selected] ?? bars[0];
  if (!current) return null;

  const pickAt = (clientX: number) => {
    const element = plot.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    let ratio = (clientX - rect.left) / rect.width;
    // The bars mirror in RTL, so the first bar sits on the right.
    if (getComputedStyle(element).direction === "rtl") ratio = 1 - ratio;
    setSelected(Math.min(bars.length - 1, Math.max(0, Math.floor(ratio * bars.length))));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const step: Record<string, number> = {
      ArrowRight: rtl ? -1 : 1,
      ArrowLeft: rtl ? 1 : -1,
      ArrowUp: 1,
      ArrowDown: -1,
    };
    if (event.key === "Home") setSelected(0);
    else if (event.key === "End") setSelected(bars.length - 1);
    else if (event.key in step) {
      setSelected((index) =>
        Math.min(bars.length - 1, Math.max(0, index + (step[event.key] ?? 0))),
      );
    } else return;
    event.preventDefault();
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5" aria-hidden>
        <span className="num text-sm font-semibold text-muted">{current.label}</span>
        <span className="num font-heading text-lg font-bold text-ink">
          {current.valueLabel}
          <span className="ms-1.5 text-sm font-medium text-muted">{current.ordersLabel}</span>
        </span>
      </p>

      <div
        ref={plot}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={bars.length}
        aria-valuenow={selected + 1}
        aria-valuetext={`${current.label}: ${current.valueLabel}, ${current.ordersLabel}`}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          pickAt(event.clientX);
        }}
        onPointerMove={(event) => {
          if (dragging.current) pickAt(event.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        className="flex h-40 cursor-pointer touch-pan-y items-end gap-0.5 rounded-sm border-b border-border pt-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {bars.map((bar, index) => {
          const height = Math.max((bar.value / max) * 100, 4);
          return (
            <div
              key={bar.key}
              className="relative flex h-full min-w-0 flex-1 items-end justify-center"
            >
              {index === peakIndex ? (
                // The busiest bar wears a small awning-coloured dot; its name is in the text below.
                <span
                  aria-hidden
                  className="absolute size-1.5 rounded-full bg-awning"
                  style={{ bottom: `calc(${height}% + 4px)` }}
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "w-full max-w-10 rounded-t-[4px] transition-[height,background-color] duration-200 ease-out motion-reduce:transition-none",
                  bar.value > 0
                    ? index === selected
                      ? "bg-chart-1"
                      : "bg-chart-1/35"
                    : index === selected
                      ? "bg-border-strong"
                      : "bg-border",
                )}
                style={{ height: bar.value > 0 ? `${height}%` : "3px" }}
              />
            </div>
          );
        })}
      </div>

      <div aria-hidden className="flex gap-0.5">
        {bars.map((bar) => (
          <span
            key={bar.key}
            className="num min-w-0 flex-1 overflow-visible text-center text-xs whitespace-nowrap text-muted"
          >
            {bar.tick}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{columnLabel}</th>
            <th scope="col">{valueColumn}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.key}>
              <th scope="row">{bar.label}</th>
              <td>{`${bar.valueLabel}, ${bar.ordersLabel}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
