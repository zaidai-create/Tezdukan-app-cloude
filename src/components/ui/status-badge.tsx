import { cn } from "cn";
import { CircleAlert, CircleCheck, CircleDot, Clock3, type LucideIcon } from "lucide-react";
import type * as React from "react";

/**
 * Status colours are fixed app-wide: green = paid / delivered / in stock, amber = pending /
 * due soon, red = overdue / cancelled / out of stock. Every badge pairs the colour with an
 * icon and a word so it reads without relying on colour.
 */
export type StatusTone = "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<StatusTone, { className: string; icon: LucideIcon }> = {
  success: { className: "bg-primary-soft text-primary-strong", icon: CircleCheck },
  warning: { className: "bg-awning-soft text-awning-ink", icon: Clock3 },
  danger: { className: "bg-danger-soft text-danger-ink", icon: CircleAlert },
  neutral: { className: "bg-subtle text-ink", icon: CircleDot },
};

type StatusBadgeProps = React.ComponentProps<"span"> & {
  tone: StatusTone;
  icon?: LucideIcon | null;
  size?: "md" | "lg";
};

function StatusBadge({ tone, icon, size = "md", className, children, ...props }: StatusBadgeProps) {
  const style = toneStyles[tone];
  const Icon = icon === null ? null : (icon ?? style.icon);
  return (
    <span
      data-slot="status-badge"
      data-tone={tone}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "md" ? "h-7 px-2.5 text-xs [&_svg]:size-3.5" : "h-8 px-3 text-sm [&_svg]:size-4",
        style.className,
        className,
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </span>
  );
}

export { StatusBadge };
