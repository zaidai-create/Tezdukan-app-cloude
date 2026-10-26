import { cn } from "cn";
import { CircleAlert, Info } from "lucide-react";
import type * as React from "react";

/**
 * Inline message above a form's submit button (auth errors, notices). Errors arrive with a
 * short shake; give the alert a new `key` per attempt so a repeated error shakes again.
 */
function FormAlert({
  tone = "error",
  className,
  children,
}: {
  tone?: "error" | "info";
  className?: string;
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? CircleAlert : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-md px-3.5 py-3 text-sm font-medium",
        tone === "error"
          ? "animate-shake bg-danger-soft text-danger-ink"
          : "animate-rise bg-subtle text-ink",
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export { FormAlert };
