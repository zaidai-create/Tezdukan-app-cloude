import { cn } from "cn";
import type * as React from "react";

type ProgressProps = React.ComponentProps<"div"> & {
  value: number;
  max?: number;
  tone?: "primary" | "awning";
};

/** Determinate bar (e.g. "Rs 1,200 more for free delivery"). Fills from the inline start. */
function Progress({ value, max = 100, tone = "primary", className, ...props }: ProgressProps) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-subtle-strong", className)}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out",
          tone === "primary" ? "bg-primary" : "bg-awning",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export { Progress };
