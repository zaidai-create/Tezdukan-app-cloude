"use client";

import { cn } from "cn";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type * as React from "react";

/**
 * Segmented choice for small option sets: unit/carton, payment method, date range.
 * Use `type="single"` for exclusive options.
 */
function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("inline-flex items-center gap-1 rounded-md bg-subtle p-1", className)}
      {...props}
    />
  );
}

function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-sm px-3.5 text-sm font-semibold whitespace-nowrap text-muted",
        "transition-colors duration-150 hover:text-ink disabled:pointer-events-none disabled:opacity-50",
        "data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-card [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
