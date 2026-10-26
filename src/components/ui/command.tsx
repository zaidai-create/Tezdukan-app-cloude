"use client";

import { Command as CommandPrimitive } from "cmdk";
import { cn } from "cn";
import { SearchIcon } from "lucide-react";
import type * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn("flex size-full flex-col overflow-hidden bg-surface text-ink", className)}
      {...props}
    />
  );
}

function CommandDialog({
  title,
  description,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        showCloseButton={false}
        className={cn("top-[15vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0", className)}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {/* cmdk's input, list and items read the store this root provides. */}
        <Command>{children}</Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  endSlot,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & { endSlot?: React.ReactNode }) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex items-center gap-3 border-b border-border px-4"
    >
      <SearchIcon className="size-5 shrink-0 text-muted" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "h-14 w-full bg-transparent text-base text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      {endSlot}
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "max-h-[min(60vh,420px)] scroll-py-2 overflow-x-hidden overflow-y-auto p-2",
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("px-4 py-8 text-center text-sm text-muted", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden text-ink **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:text-muted",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-2 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex min-h-12 cursor-default items-center gap-3 rounded-md px-3 py-2 text-base outline-none select-none",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-subtle",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5 [&_svg:not([class*='text-'])]:text-muted",
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ms-auto text-xs tracking-wide text-muted", className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
