import { cn } from "cn";
import type * as React from "react";

/** Shared field chrome: 48px tall, 10px radius, 3:1 outline, clear invalid state. */
export const fieldClass = cn(
  "w-full min-w-0 rounded-md border border-border-strong bg-surface text-base text-ink",
  "transition-[border-color,box-shadow] duration-150 placeholder:text-muted",
  "outline-none focus-visible:border-primary-strong focus-visible:ring-3 focus-visible:ring-primary/20 focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-70",
  "aria-invalid:border-danger-ink aria-invalid:ring-danger/15 aria-invalid:focus-visible:ring-3",
);

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldClass,
        "h-12 px-3.5 file:me-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
