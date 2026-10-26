import { cn } from "cn";
import type * as React from "react";

type SpeedLinesProps = React.ComponentProps<"span"> & {
  /** Animate the lines (loaders, "order placed", Munshi listening). Static otherwise. */
  animated?: boolean;
  tone?: "primary" | "mint" | "on-action";
};

const toneClass = {
  primary: "bg-primary",
  mint: "bg-mint",
  "on-action": "bg-on-action",
} as const;

/**
 * Three short motion lines from the logo: a TezDukan signature. They trail behind the
 * direction of travel, so they mirror in RTL.
 */
function SpeedLines({ animated = false, tone = "primary", className, ...props }: SpeedLinesProps) {
  const lines = [
    { width: "w-[70%]", delay: "0ms", inset: "ms-0" },
    { width: "w-full", delay: "140ms", inset: "ms-[18%]" },
    { width: "w-[52%]", delay: "280ms", inset: "ms-[36%]" },
  ];
  return (
    <span
      aria-hidden
      data-slot="speed-lines"
      className={cn("inline-flex w-8 flex-col gap-[3px] rtl:-scale-x-100", className)}
      {...props}
    >
      {lines.map((line) => (
        <span
          key={line.delay}
          className={cn(
            "h-[3px] rounded-full",
            line.width,
            line.inset,
            toneClass[tone],
            animated && "animate-speed-line [--speed-from:45%] [--speed-to:-35%]",
          )}
          style={animated ? { animationDelay: line.delay } : undefined}
        />
      ))}
    </span>
  );
}

/**
 * Inline loader built from the speed lines. For sections that are loading without a
 * skeleton (sending a message, placing an order). Never used full screen.
 */
function SpeedLoader({ label, className }: { label: string; className?: string }) {
  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-2.5 text-sm text-muted", className)}
    >
      <SpeedLines animated className="w-7" />
      <span>{label}</span>
    </span>
  );
}

export { SpeedLines, SpeedLoader };
