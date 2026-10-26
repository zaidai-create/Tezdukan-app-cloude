import { cn } from "cn";
import type * as React from "react";

/**
 * Input with fixed text or icons on either side ("+92", "Rs", a search icon, a mic button).
 * The group draws the border so the adornments sit inside the field.
 */
function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "flex h-12 w-full min-w-0 items-center rounded-md border border-border-strong bg-surface text-base text-ink",
        "transition-[border-color,box-shadow] duration-150",
        "focus-within:border-primary-strong focus-within:ring-3 focus-within:ring-primary/20",
        "has-[[aria-invalid=true]]:border-danger-ink has-[[aria-invalid=true]]:ring-danger/15",
        "has-[:disabled]:bg-subtle has-[:disabled]:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupAddon({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "flex h-full shrink-0 items-center gap-1 px-3 text-muted [&_svg:not([class*='size-'])]:size-5",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input-group-control"
      className={cn(
        "h-full min-w-0 flex-1 bg-transparent px-3.5 text-base text-ink outline-none placeholder:text-muted",
        "focus-visible:outline-none disabled:cursor-not-allowed",
        "[[data-slot=input-group-addon]+&]:ps-0",
        className,
      )}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon, InputGroupInput };
