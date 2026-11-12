import { cn } from "cn";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Clock3,
  FileWarning,
  MessageCircle,
  PartyPopper,
  Store,
  Truck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { Awning } from "@/components/brand/awning";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { getMyApplications } from "./data";
import type { Application } from "./schemas";

/** Sent → being checked → ready, with where this application is. */
async function Timeline({ application }: { application: Application }) {
  const t = await getTranslations("applications");
  const approved = application.status === "approved";
  const steps = [
    { label: t("stepSent"), done: true },
    { label: t("stepChecking"), done: approved, current: application.status === "pending" },
    {
      label: application.kind === "dukan" ? t("stepReadyDukan") : t("stepReadyDistributor"),
      done: approved,
    },
  ];
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => (
        <li key={step.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                step.done
                  ? "bg-action text-on-action"
                  : step.current
                    ? "bg-awning-soft text-awning-ink"
                    : "bg-subtle text-muted",
              )}
            >
              {step.done ? (
                <Check aria-hidden className="size-4" strokeWidth={2.5} />
              ) : (
                <Clock3 aria-hidden className="size-4" strokeWidth={1.75} />
              )}
            </span>
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "my-1 w-0.5 flex-1 rounded-full",
                  step.done ? "bg-action" : "bg-border",
                )}
              />
            ) : null}
          </div>
          <div className="pb-4">
            <p
              className={cn("font-semibold", step.done || step.current ? "text-ink" : "text-muted")}
            >
              {step.label}
            </p>
            {step.current ? <p className="text-sm text-muted">{t("checkingHint")}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

async function ApplicationCard({ application }: { application: Application }) {
  const t = await getTranslations("applications");
  const Icon = application.kind === "dukan" ? Store : Truck;
  const startHref = application.kind === "dukan" ? "/start/dukan" : "/start/distributor";
  const role = application.kind === "dukan" ? "dukandar" : "distributor";
  const home = application.kind === "dukan" ? "/dukan" : "/distributor";
  const openHref = `/api/context/switch?${new URLSearchParams({ role, context: application.id, next: home })}`;
  return (
    <li className="flex flex-col gap-4 rounded-[18px] border border-border/60 bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mint-soft text-primary-strong">
          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <h2 className="font-heading text-lg leading-tight font-bold text-ink">
            {application.name}
          </h2>
          <p className="num text-sm text-muted">
            {application.kind === "dukan" ? t("kindDukan") : t("kindDistributor")}
            {application.submitted_at
              ? ` · ${t("sentOn", { date: formatDate(application.submitted_at) })}`
              : null}
          </p>
          {application.status === "approved" ? (
            <StatusBadge tone="success">{t("approved")}</StatusBadge>
          ) : application.status === "pending" ? (
            <StatusBadge tone="warning">{t("pending")}</StatusBadge>
          ) : application.status === "rejected" ? (
            <StatusBadge tone="danger">{t("rejected")}</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">{t("paused")}</StatusBadge>
          )}
        </div>
      </div>

      {application.status === "rejected" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-danger-ink">
            <FileWarning aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
            <div>
              <p className="font-semibold">{t("reasonTitle")}</p>
              <p className="text-sm">{application.rejection_reason ?? t("reasonMissing")}</p>
            </div>
          </div>
          <Link href={startHref} className={buttonVariants({ size: "lg", block: true })}>
            {t("applyAgain")}
          </Link>
        </div>
      ) : application.status === "approved" ? (
        <a href={openHref} className={buttonVariants({ size: "lg", block: true })}>
          <BadgeCheck aria-hidden />
          {application.kind === "dukan" ? t("openDukan") : t("openBusiness")}
        </a>
      ) : application.status === "pending" ? (
        <Timeline application={application} />
      ) : (
        <p className="text-sm text-muted">{application.rejection_reason ?? t("pausedHint")}</p>
      )}
    </li>
  );
}

async function StatusContent({ sent }: { sent: Promise<boolean> }) {
  await connection();
  await requireSession();
  const [t, applications, justSent] = await Promise.all([
    getTranslations("applications"),
    getMyApplications(),
    sent,
  ]);
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-5 pb-10">
      <header className="flex items-center gap-3">
        <Link
          href="/account"
          aria-label={t("back")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-card"
        >
          <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
        </Link>
        <h1 className="font-heading text-2xl font-bold text-ink">{t("title")}</h1>
      </header>

      {/* Only while something is still waiting: a reload after approval shows the result. */}
      {justSent && applications.some((application) => application.status === "pending") ? (
        <section className="overflow-hidden rounded-[22px] bg-action text-on-action shadow-raised">
          <Awning height={14} />
          <div className="flex items-start gap-3 p-5">
            <PartyPopper aria-hidden className="mt-0.5 size-7 shrink-0" strokeWidth={1.75} />
            <div>
              <p className="font-heading text-xl font-bold">{t("sentTitle")}</p>
              <p className="text-sm opacity-90">{t("sentHint")}</p>
            </div>
          </div>
        </section>
      ) : null}

      {applications.length === 0 ? (
        <EmptyState
          icon={Store}
          title={t("emptyTitle")}
          description={t("emptyHint")}
          action={
            <Link href="/start/dukan" className={buttonVariants({ size: "lg" })}>
              {t("registerDukan")}
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {applications.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </ul>
      )}

      <Link
        href="/account/support"
        className="flex min-h-14 items-center gap-3 rounded-[18px] border border-border/60 bg-surface px-4 font-semibold text-ink shadow-card"
      >
        <MessageCircle aria-hidden className="size-5 text-primary-strong" strokeWidth={1.75} />
        {t("questions")}
      </Link>
    </div>
  );
}

/** Where the person's dukan or distributor registrations stand, and what to do next. */
export function RegistrationStatusPage({ sent }: { sent: Promise<boolean> }) {
  return (
    <main className="min-h-dvh bg-canvas">
      <Suspense
        fallback={
          <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-5" aria-hidden>
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <Skeleton className="h-8 w-48" />
            </div>
            <Skeleton className="h-56 w-full rounded-[18px]" />
          </div>
        }
      >
        <StatusContent sent={sent} />
      </Suspense>
    </main>
  );
}
