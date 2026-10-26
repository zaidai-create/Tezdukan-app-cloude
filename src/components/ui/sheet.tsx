"use client";

import { cn } from "cn";
import { XIcon } from "lucide-react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive, Direction } from "radix-ui";
import * as React from "react";

/**
 * Bottom sheet (mobile) or end-side panel (desktop). Radix Dialog provides focus trapping,
 * Escape and aria wiring; Motion provides the spring and drag-to-dismiss. Dragging starts
 * from the handle/header only, so long content inside the sheet still scrolls normally.
 */
type SheetContextValue = { open: boolean; setOpen: (open: boolean) => void };
const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheet() {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error("Sheet components must be used inside <Sheet>");
  return ctx;
}

type SheetProps = Omit<
  React.ComponentProps<typeof DialogPrimitive.Root>,
  "open" | "onOpenChange"
> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function Sheet({ open: openProp, defaultOpen = false, onOpenChange, ...props }: SheetProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen} {...props} />
    </SheetContext.Provider>
  );
}

const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

type SheetContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "bottom" | "end";
  showHandle?: boolean;
  showCloseButton?: boolean;
};

const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 600;

function SheetContent({
  side = "bottom",
  showHandle = side === "bottom",
  showCloseButton = side === "end",
  className,
  children,
  ...props
}: SheetContentProps) {
  const { open, setOpen } = useSheet();
  const t = useTranslations("common");
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const rtl = Direction.useDirection() === "rtl";

  const spring = reduceMotion
    ? { duration: 0 }
    : ({ type: "spring", damping: 34, stiffness: 360, mass: 0.9 } as const);
  const hidden = side === "bottom" ? { y: "100%" } : { x: rtl ? "-100%" : "100%" };
  const shown = side === "bottom" ? { y: 0 } : { x: 0 };

  return (
    <AnimatePresence>
      {open ? (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div
              data-slot="sheet-overlay"
              className="fixed inset-0 z-50 bg-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
            />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content asChild forceMount {...props}>
            <motion.div
              data-slot="sheet-content"
              data-side={side}
              className={cn(
                "fixed z-50 flex flex-col bg-surface text-ink shadow-sheet outline-none",
                side === "bottom" &&
                  "pb-safe inset-x-0 bottom-0 mx-auto max-h-[92dvh] w-full max-w-xl rounded-t-2xl",
                side === "end" && "inset-y-0 end-0 h-dvh w-full max-w-md border-s border-border",
                className,
              )}
              initial={hidden}
              animate={shown}
              exit={hidden}
              transition={spring}
              drag={side === "bottom" ? "y" : false}
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY)
                  setOpen(false);
              }}
            >
              {showHandle ? (
                <div
                  data-slot="sheet-handle"
                  className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                  onPointerDown={(event) => dragControls.start(event)}
                >
                  <span className="h-1.5 w-10 rounded-full bg-border-strong/40" />
                </div>
              ) : null}
              {children}
              {showCloseButton ? (
                <DialogPrimitive.Close
                  data-slot="sheet-close"
                  className="absolute end-3 top-3 inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-ink"
                >
                  <XIcon className="size-5" />
                  <span className="sr-only">{t("close")}</span>
                </DialogPrimitive.Close>
              ) : null}
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      ) : null}
    </AnimatePresence>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "grid shrink-0 gap-1 px-5 pt-2 pb-3 [[data-side=end]_&]:pe-14 [[data-side=end]_&]:pt-5",
        className,
      )}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex shrink-0 gap-3 border-t border-border px-5 py-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-xl font-semibold text-ink", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  useSheet,
};
