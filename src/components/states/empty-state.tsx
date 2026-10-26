import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { Awning } from "@/components/brand/awning";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** One clear action (a Button or Link styled as a button). */
  action?: React.ReactNode;
  /** Show the awning motif. Turn off when the screen already shows one. */
  awning?: boolean;
  className?: string;
};

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  awning = true,
  className,
}: EmptyStateProps) {
  return (
    <section
      data-slot="empty-state"
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col items-center px-6 py-10 text-center",
        className,
      )}
    >
      <div className="relative mb-5 w-40">
        {awning ? <Awning height={14} stripe={16} className="rounded-t-md" /> : null}
        <div
          className={cn(
            "flex h-24 items-center justify-center rounded-b-lg bg-primary-soft text-primary-strong",
            awning ? "-mt-2" : "rounded-lg",
          )}
        >
          <Icon aria-hidden className="size-10" />
        </div>
      </div>
      <h2 className="font-heading text-xl font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-2 text-base text-muted">{description}</p> : null}
      {action ? <div className="mt-6 w-full max-w-64 [&>*]:w-full">{action}</div> : null}
    </section>
  );
}

export { EmptyState };
