"use client";

import { cn } from "cn";
import { useState } from "react";
import type * as React from "react";

export type MarketBar = {
  key: string;
  label: string;
  tick: string;
  customer: number;
  b2b: number;
  customerLabel: string;
  b2bLabel: string;
  totalLabel: string;
};

/**
 * Daily sales as stacked bars: customer orders below, dukan orders from distributors above,
 * a 2px gap between them. Tap, drag or use the arrow keys to read a day.
 */
export function MarketplaceChart({
  bars,
  label,
  legend,
  tableCaption,
  columns,
}: {
  bars: MarketBar[];
  label: string;
  legend: { customer: string; b2b: string };
  tableCaption: string;
  columns: { day: string; customer: string; b2b: string };
}) {
  const [selected, setSelected] = useState(bars.length - 1);
  const max = Math.max(...bars.map((bar) => bar.customer + bar.b2b), 1);
  const current = bars[selected] ?? bars[bars.length - 1];
  if (!current) return null;

  const pickAt = (element: HTMLElement, clientX: number) => {
    const rect = element.getBoundingClientRect();
    let ratio = (clientX - rect.left) / rect.width;
    if (getComputedStyle(element).direction === "rtl") ratio = 1 - ratio;
    setSelected(Math.min(bars.length - 1, Math.max(0, Math.floor(ratio * bars.length))));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const step =
      event.key === "ArrowRight" ? (rtl ? -1 : 1) : event.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    if (!step) return;
    event.preventDefault();
    setSelected((index) => Math.min(bars.length - 1, Math.max(0, index + step)));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-chart-1" />
          {legend.customer}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-chart-2" />
          {legend.b2b}
        </span>
      </div>
      <div aria-hidden className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="num text-sm font-semibold text-muted">{current.label}</span>
        <span className="num font-heading text-lg font-bold text-ink">{current.totalLabel}</span>
      </div>
      <p aria-hidden className="num -mt-2 text-sm text-muted">
        {`${legend.customer}: ${current.customerLabel} · ${legend.b2b}: ${current.b2bLabel}`}
      </p>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={bars.length}
        aria-valuenow={selected + 1}
        aria-valuetext={`${current.label}: ${current.totalLabel}`}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pickAt(event.currentTarget, event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.buttons) pickAt(event.currentTarget, event.clientX);
        }}
        className="flex h-44 cursor-pointer touch-pan-y items-end gap-1 border-b border-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {bars.map((bar, index) => {
          const total = bar.customer + bar.b2b;
          return (
            <div
              key={bar.key}
              className={cn(
                "flex h-full min-w-0 flex-1 flex-col justify-end gap-0.5 transition-opacity duration-150",
                index === selected ? "opacity-100" : "opacity-55",
              )}
            >
              {total === 0 ? <span className="h-[3px] rounded-t-[4px] bg-border" /> : null}
              {bar.b2b > 0 ? (
                <span
                  className={cn("w-full bg-chart-2", "rounded-t-[4px]")}
                  style={{ height: `${Math.max((bar.b2b / max) * 100, 2)}%` }}
                />
              ) : null}
              {bar.customer > 0 ? (
                <span
                  className={cn("w-full bg-chart-1", bar.b2b > 0 ? "" : "rounded-t-[4px]")}
                  style={{ height: `${Math.max((bar.customer / max) * 100, 2)}%` }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div aria-hidden className="flex gap-1">
        {bars.map((bar) => (
          <span key={bar.key} className="num min-w-0 flex-1 text-center text-xs text-muted">
            {bar.tick}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{columns.day}</th>
            <th scope="col">{columns.customer}</th>
            <th scope="col">{columns.b2b}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.key}>
              <th scope="row">{bar.label}</th>
              <td>{bar.customerLabel}</td>
              <td>{bar.b2bLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
