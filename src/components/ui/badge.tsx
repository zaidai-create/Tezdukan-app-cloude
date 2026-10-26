import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-sm font-semibold whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-subtle text-ink",
        primary: "bg-primary-soft text-primary-strong",
        // Offers, schemes, ratings: the awning colour.
        offer: "bg-awning text-on-awning",
        // Sale tags and urgent badges, used sparingly.
        sale: "bg-awning-deep text-on-awning",
        danger: "bg-danger-soft text-danger-ink",
        outline: "border border-border-strong text-ink",
        solid: "bg-action text-on-action",
      },
      size: {
        sm: "h-5 px-1.5 text-xs [&_svg]:size-3",
        md: "h-6 px-2 text-xs [&_svg]:size-3.5",
        lg: "h-7 px-2.5 text-sm [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
