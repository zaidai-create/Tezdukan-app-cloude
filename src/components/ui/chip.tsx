"use client";

import { cn } from "cn";
import { XIcon } from "lucide-react";
import type * as React from "react";

const chipBase = cn(
  "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap select-none",
  "transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-1",
  "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
);

type FilterChipProps = Omit<React.ComponentProps<"button">, "onChange"> & {
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  count?: number;
};

/** Toggleable quick filter ("In stock", "Has scheme", "Tapal"). */
function FilterChip({
  selected = false,
  onSelectedChange,
  count,
  className,
  children,
  onClick,
  ...props
}: FilterChipProps) {
  return (
    <button
      type="button"
      data-slot="filter-chip"
      aria-pressed={selected}
      className={cn(
        chipBase,
        selected
          ? "border-primary bg-primary-soft text-primary-strong"
          : "border-border-strong/50 bg-surface text-ink hover:bg-subtle",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onSelectedChange?.(!selected);
      }}
      {...props}
    >
      {children}
      {count !== undefined ? (
        <span className="num text-xs font-medium opacity-80">{count}</span>
      ) : null}
    </button>
  );
}

type ChipProps = React.ComponentProps<"span"> & {
  onRemove?: () => void;
  removeLabel?: string;
};

/** Static chip, optionally removable (applied filters, selected brands). */
function Chip({ onRemove, removeLabel, className, children, ...props }: ChipProps) {
  return (
    <span
      data-slot="chip"
      className={cn(
        chipBase,
        "border-border bg-subtle text-ink after:content-none",
        onRemove && "pe-1",
        className,
      )}
      {...props}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-subtle-strong hover:text-ink"
        >
          <XIcon />
        </button>
      ) : null}
    </span>
  );
}

/** Horizontally scrolling chip row that bleeds to the screen edge on mobile. */
function ChipRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chip-row"
      className={cn("flex scroll-px-4 scrollbar-none gap-2 overflow-x-auto px-4 py-1", className)}
      {...props}
    />
  );
}

export { Chip, ChipRow, FilterChip };
