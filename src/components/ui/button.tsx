import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";
import type * as React from "react";

const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap select-none",
    "transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "sheen bg-action text-on-action shadow-glow inset-shadow-edge hover:bg-action-hover",
        secondary: "border border-border-strong bg-surface text-ink hover:bg-subtle",
        outline:
          "border-[1.5px] border-primary bg-surface text-primary-strong hover:bg-primary-soft",
        soft: "bg-primary-soft text-primary-strong hover:bg-[color-mix(in_oklab,var(--primary-soft),var(--primary)_10%)]",
        ghost: "text-ink hover:bg-subtle",
        danger:
          "bg-danger-ink text-on-danger hover:bg-[color-mix(in_oklab,var(--danger-ink),var(--ink)_12%)]",
        "danger-soft":
          "bg-danger-soft text-danger-ink hover:bg-[color-mix(in_oklab,var(--danger-soft),var(--danger)_10%)]",
        link: "h-auto px-0 text-primary-strong underline-offset-4 hover:underline",
      },
      size: {
        // 40px visual with a 48px hit area (touch target minimum).
        sm: "h-10 px-3.5 text-sm after:absolute after:inset-x-0 after:-inset-y-1 [&_svg:not([class*='size-'])]:size-4",
        md: "h-12 px-5 text-base [&_svg:not([class*='size-'])]:size-5",
        lg: "h-14 px-6 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-12 [&_svg:not([class*='size-'])]:size-5",
        "icon-sm":
          "size-10 after:absolute after:-inset-1 [&_svg:not([class*='size-'])]:size-[18px]",
      },
      block: {
        true: "w-full",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows an inline progress indicator and blocks repeat taps. */
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "primary"}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants, type ButtonProps };
