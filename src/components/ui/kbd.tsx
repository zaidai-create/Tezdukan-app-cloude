import { cn } from "cn";
import type * as React from "react";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-xs border border-border bg-subtle px-1.5 font-sans text-xs font-semibold text-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
