import { cn } from "cn";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/** A titled block on a browsing screen, with an optional "See all" link. */
function Section({
  title,
  hint,
  action,
  children,
  className,
  bleed = false,
}: {
  title: string;
  hint?: string;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
  /** Children run edge to edge (horizontal rails); the header keeps the page gutter. */
  bleed?: boolean;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-end justify-between gap-3 px-4">
        <div className="min-w-0">
          <h2 className="font-heading text-lg leading-tight font-bold text-ink">{title}</h2>
          {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            prefetch
            className="relative flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary-strong after:absolute after:-inset-3"
          >
            {action.label}
            <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
          </Link>
        ) : null}
      </div>
      <div className={bleed ? undefined : "px-4"}>{children}</div>
    </section>
  );
}

/** Horizontal, snap-scrolling row that bleeds to the screen edges. */
function Rail({ children }: { children: ReactNode }) {
  return (
    <div className="flex snap-x scroll-px-4 scrollbar-none gap-3 overflow-x-auto px-4 pb-1 [&>*]:shrink-0">
      {children}
    </div>
  );
}

export { Rail, Section };
