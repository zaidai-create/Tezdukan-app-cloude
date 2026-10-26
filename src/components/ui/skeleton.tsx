import { cn } from "cn";
import type * as React from "react";

/** Placeholder block. Compose skeletons that match the final layout; never a page spinner. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("skeleton rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
