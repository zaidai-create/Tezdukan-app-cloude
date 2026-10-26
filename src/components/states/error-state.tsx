"use client";

import { cn } from "cn";
import { CloudOff, RotateCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** Network failures read differently from server errors. */
  kind?: "error" | "offline";
  compact?: boolean;
  className?: string;
};

function ErrorState({
  title,
  description,
  onRetry,
  retrying = false,
  kind = "error",
  compact = false,
  className,
}: ErrorStateProps) {
  const t = useTranslations("states");
  const Icon = kind === "offline" ? CloudOff : TriangleAlert;
  return (
    <section
      role="alert"
      data-slot="error-state"
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col items-center text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-10",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full",
          compact ? "size-12" : "size-16",
          kind === "offline" ? "bg-subtle text-muted" : "bg-danger-soft text-danger-ink",
        )}
      >
        <Icon aria-hidden className={compact ? "size-6" : "size-8"} />
      </span>
      <h2 className={cn("font-heading font-semibold text-ink", compact ? "text-base" : "text-xl")}>
        {title ?? (kind === "offline" ? t("offlineTitle") : t("errorTitle"))}
      </h2>
      <p className="text-sm text-muted">
        {description ?? (kind === "offline" ? t("offlineBody") : t("errorBody"))}
      </p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} loading={retrying} className="mt-2">
          {retrying ? null : <RotateCw aria-hidden />}
          {t("retry")}
        </Button>
      ) : null}
    </section>
  );
}

export { ErrorState };
