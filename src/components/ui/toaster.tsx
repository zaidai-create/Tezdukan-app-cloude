"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/lib/theme/use-theme";

/**
 * Toasts sit above the bottom nav and cart bar on mobile. Reversible actions pass an
 * `action: { label: t("common.undo"), onClick }` so people can take them back.
 */
function Toaster({ dir }: { dir: "ltr" | "rtl" }) {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      dir={dir}
      position="bottom-center"
      offset={24}
      mobileOffset={{ bottom: "calc(var(--bottom-nav-height) + 72px + var(--safe-bottom))" }}
      visibleToasts={3}
      gap={8}
      icons={{
        success: <CircleCheck className="size-5 text-primary" />,
        info: <Info className="size-5 text-muted" />,
        warning: <TriangleAlert className="size-5 text-awning-ink" />,
        error: <CircleAlert className="size-5 text-danger-ink" />,
        loading: <LoaderCircle className="size-5 animate-spin text-muted" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-lg border border-border bg-ink px-4 py-3 text-sm text-surface shadow-raised dark:bg-surface dark:text-ink",
          title: "font-semibold",
          description: "text-surface/80 dark:text-muted",
          actionButton:
            "ms-auto inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-bold text-mint dark:text-primary-strong",
          cancelButton: "inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold",
          icon: "shrink-0",
        },
      }}
    />
  );
}

export { Toaster };
