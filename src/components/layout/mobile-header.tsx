import { cn } from "cn";
import type * as React from "react";
import { MunshiButton } from "@/components/munshi/munshi-button";
import type { ShellSession } from "@/lib/auth/session-types";
import { ContextButton } from "./context-button";
import { UserMenu } from "./user-menu";

/** Sticky, frosted mobile header: active shop/role (tap to switch), Munshi and the user menu. */
function MobileHeader({
  session,
  children,
  className,
}: {
  session: ShellSession;
  /** Extra row under the header (e.g. the delivery-promise chip on the dukandar home). */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("material pt-safe sticky top-0 z-30 border-b border-border/70", className)}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <ContextButton session={session} className="min-w-0 flex-1" />
        <MunshiButton />
        <UserMenu session={session} />
      </div>
      {children}
    </header>
  );
}

function MobileHeaderSkeleton() {
  return (
    <div className="pt-safe sticky top-0 z-30 border-b border-border/70 bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2.5">
          <div className="skeleton size-10 rounded-md" />
          <div className="flex flex-col gap-1.5">
            <div className="skeleton h-4 w-32 rounded-sm" />
            <div className="skeleton h-3 w-16 rounded-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="skeleton h-10 w-24 rounded-full" />
          <div className="skeleton size-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export { MobileHeader, MobileHeaderSkeleton };
