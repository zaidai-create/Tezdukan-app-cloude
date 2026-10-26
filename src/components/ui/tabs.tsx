"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";

const Tabs = TabsPrimitive.Root;

const tabsListVariants = cva("inline-flex items-center", {
  variants: {
    variant: {
      // Underlined tabs for page sections (orders: All / Pending / Delivered …).
      line: "w-full scrollbar-none gap-1 overflow-x-auto border-b border-border",
      // Pill segmented control for compact switches (Today / Week / Month).
      segmented: "gap-1 rounded-md bg-subtle p-1",
    },
  },
  defaultVariants: { variant: "line" },
});

function TabsList({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant ?? "line"}
      className={cn("group/tabs", tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap text-muted transition-colors duration-150",
        "hover:text-ink disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        // line
        "group-data-[variant=line]/tabs:h-12 group-data-[variant=line]/tabs:px-3 group-data-[variant=line]/tabs:text-base",
        "group-data-[variant=line]/tabs:after:absolute group-data-[variant=line]/tabs:after:inset-x-2 group-data-[variant=line]/tabs:after:bottom-0 group-data-[variant=line]/tabs:after:h-[3px] group-data-[variant=line]/tabs:after:rounded-t-full",
        "group-data-[variant=line]/tabs:data-[state=active]:text-primary-strong group-data-[variant=line]/tabs:data-[state=active]:after:bg-primary",
        // segmented
        "group-data-[variant=segmented]/tabs:h-10 group-data-[variant=segmented]/tabs:rounded-sm group-data-[variant=segmented]/tabs:px-4 group-data-[variant=segmented]/tabs:text-sm",
        "group-data-[variant=segmented]/tabs:data-[state=active]:bg-surface group-data-[variant=segmented]/tabs:data-[state=active]:text-ink group-data-[variant=segmented]/tabs:data-[state=active]:shadow-card",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
