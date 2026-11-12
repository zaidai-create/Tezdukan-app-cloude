import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";

/** Shared pieces of the admin screens: header, tabs, metric tiles and status tags. */

export function AdminHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-bold text-ink lg:text-3xl">{title}</h1>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
      {children}
    </header>
  );
}

export function AdminPageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">{children}</div>;
}

/** Capsule tabs that are links, so each view has its own address (and Back works). */
export function LinkTabs({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; active: boolean; count?: number }[];
}) {
  return (
    <nav
      aria-label={label}
      className="flex gap-1 overflow-x-auto rounded-full border border-border/60 bg-surface p-1 shadow-card"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex min-h-11 shrink-0 grow items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 ease-out",
            item.active
              ? "sheen bg-action text-on-action shadow-glow inset-shadow-edge"
              : "text-ink",
          )}
        >
          {item.label}
          {item.count ? (
            <span
              className={cn(
                "num rounded-full px-1.5 text-xs",
                item.active ? "bg-on-action/20" : "bg-danger text-on-danger",
              )}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export function MetricTile({
  label,
  value,
  icon: Icon,
  children,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <dt className="flex items-center gap-1.5 text-sm font-semibold text-muted">
        {Icon ? <Icon aria-hidden className="size-4" strokeWidth={1.75} /> : null}
        {label}
      </dt>
      <dd className="num font-heading text-2xl font-bold text-ink">{value}</dd>
      {children ? <dd className="flex flex-col gap-0.5 text-sm text-muted">{children}</dd> : null}
    </div>
  );
}

const approvalTone: Record<string, StatusTone> = {
  approved: "success",
  pending: "warning",
  suspended: "danger",
  rejected: "neutral",
  draft: "neutral",
};

/** Status of a dukan or distributor: Active, Waiting, Paused, Rejected. */
export function ApprovalTag({ status, label }: { status: string; label: string }) {
  return (
    <StatusBadge tone={approvalTone[status] ?? "neutral"} size="md">
      {label}
    </StatusBadge>
  );
}

const orderTone: Record<string, StatusTone> = {
  placed: "warning",
  new: "warning",
  delivered: "success",
  cancelled: "danger",
  rejected: "danger",
  returned: "danger",
};

export function OrderTag({ status, label }: { status: string; label: string }) {
  return <StatusBadge tone={orderTone[status] ?? "neutral"}>{label}</StatusBadge>;
}

/** A single rounded list; rows are separated by hairlines rather than nested cards. */
/**
 * Column titles above a list that turns into a table on a wide screen. Hidden from screen
 * readers: every cell carries its own label.
 */
export function TableHead({ columns, labels }: { columns: string; labels: string[] }) {
  return (
    <li
      aria-hidden
      className={cn(
        "hidden items-center gap-4 bg-subtle/70 px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase lg:grid",
        columns,
      )}
    >
      {labels.map((label, index) => (
        <span key={`${label}-${index}`} className="truncate">
          {label}
        </span>
      ))}
    </li>
  );
}

export function ListCard({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul
      aria-label={label}
      className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-lg border border-border/60 bg-surface shadow-card"
    >
      {children}
    </ul>
  );
}

/** "12% up vs yesterday" for a metric tile; nothing when there is no earlier figure. */
export function ChangeLine({
  change,
  up,
  down,
  same,
}: {
  change: number | null;
  up: string;
  down: string;
  same: string;
}) {
  if (change === null) return null;
  return (
    <span
      className={cn(
        "num text-sm font-semibold",
        change > 0 ? "text-primary-strong" : change < 0 ? "text-danger-ink" : "text-muted",
      )}
    >
      {change > 0 ? up : change < 0 ? down : same}
    </span>
  );
}
