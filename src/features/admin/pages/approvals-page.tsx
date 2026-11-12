import { BadgeCheck, FileWarning, IdCard, MapPin, MessageSquareShare, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/session";
import { telHref, whatsappHref } from "@/lib/contact";
import { formatPkMobile } from "@/lib/phone";
import { AdminHeader, AdminPageShell } from "../components/admin-ui";
import { EntityActions } from "../components/entity-actions";
import { FlagToggle } from "../components/flag-toggle";
import { TimeAgo } from "../components/time-ago";
import { formatCnic } from "@/features/onboarding/schemas";
import { getApprovals, signKycDocuments } from "../data";
import type { Approvals } from "../schemas";

type Waiting = Approvals["shops"][number] | Approvals["orgs"][number];

/** CNIC number, both sides and the place photo, each opening full size in a new tab. */
async function Documents({ item, signed }: { item: Waiting; signed: Map<string, string> }) {
  const t = await getTranslations("admin.approvals");
  const documents = item.documents;
  if (!documents) {
    return (
      <p className="flex items-start gap-2 rounded-md bg-awning-soft p-3 text-sm text-awning-ink">
        <FileWarning aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        {t("noDocuments")}
      </p>
    );
  }
  const photos = [
    { label: t("cnicFront"), path: documents.cnic_front_path },
    { label: t("cnicBack"), path: documents.cnic_back_path },
    { label: t("placePhoto"), path: documents.place_photo_path },
  ];
  return (
    <section
      className="flex flex-col gap-2 rounded-md bg-subtle/60 p-3"
      aria-label={t("documents")}
    >
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <IdCard aria-hidden className="size-4 text-primary-strong" strokeWidth={1.75} />
          {t("cnic")}{" "}
          <span dir="ltr" className="num tracking-wide">
            {formatCnic(documents.cnic_number)}
          </span>
        </span>
        {item.ntn ? (
          <span>
            {t("ntn")}{" "}
            <span dir="ltr" className="num">
              {item.ntn}
            </span>
          </span>
        ) : null}
        {item.strn ? (
          <span>
            {t("strn")}{" "}
            <span dir="ltr" className="num">
              {item.strn}
            </span>
          </span>
        ) : null}
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((photo) => {
          const url = signed.get(photo.path);
          return (
            <li key={photo.path} className="flex flex-col gap-1">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-[4/3] overflow-hidden rounded-md border border-border/60 bg-surface"
                >
                  {/* A signed link that expires in minutes: the image optimiser would keep a
                      copy of a private document, so the browser loads it directly. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={photo.label} className="size-full object-cover" />
                </a>
              ) : (
                <span className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-border bg-surface">
                  <FileWarning aria-hidden className="size-5 text-muted" strokeWidth={1.75} />
                </span>
              )}
              <span className="truncate text-xs font-semibold text-muted">{photo.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

async function WaitingCard({
  item,
  target,
  signed,
}: {
  item: Waiting;
  target: "shop" | "org";
  signed: Map<string, string>;
}) {
  const t = await getTranslations("admin");
  const phone = item.owner_phone ?? item.phone;
  const tel = telHref(phone);
  const wa = whatsappHref(phone);
  const map =
    item.lat !== null && item.lng !== null
      ? `https://www.google.com/maps?q=${item.lat},${item.lng}`
      : null;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-lg font-bold text-ink">{item.name}</h3>
          <p className="text-sm text-muted">
            {[item.owner_name, phone ? formatPkMobile(phone) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="num shrink-0 text-xs text-muted">
          <TimeAgo value={item.submitted_at ?? item.created_at} />
        </span>
      </div>
      {item.address_line || item.area ? (
        <p className="text-sm text-ink">
          {[item.address_line, item.area].filter(Boolean).join(", ")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {tel ? (
          <a
            href={tel}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary-soft px-4 text-sm font-semibold text-primary-strong"
          >
            <Phone aria-hidden className="size-4" strokeWidth={1.75} />
            {t("list.call")}
          </a>
        ) : null}
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary-soft px-4 text-sm font-semibold text-primary-strong"
          >
            <MessageSquareShare aria-hidden className="size-4" strokeWidth={1.75} />
            {t("list.whatsapp")}
          </a>
        ) : null}
        {map ? (
          <a
            href={map}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-subtle px-4 text-sm font-semibold text-ink"
          >
            <MapPin aria-hidden className="size-4" strokeWidth={1.75} />
            {t("approvals.map")}
          </a>
        ) : null}
      </div>
      <Documents item={item} signed={signed} />
      <EntityActions target={target} id={item.id} status="pending" />
    </li>
  );
}

async function ApprovalsContent() {
  await connection();
  await requireRole("admin", "/admin/approvals");
  const [t, data] = await Promise.all([getTranslations("admin"), getApprovals()]);
  const total = data.shops.length + data.orgs.length;
  const signed = await signKycDocuments(
    [...data.shops, ...data.orgs].flatMap((item) =>
      item.documents
        ? [
            item.documents.cnic_front_path,
            item.documents.cnic_back_path,
            item.documents.place_photo_path,
          ]
        : [],
    ),
  );
  return (
    <AdminPageShell>
      <AdminHeader title={t("approvals.title")} subtitle={t("approvals.subtitle")} />
      <section className="flex items-center gap-4 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">{t("approvals.autoTitle")}</h2>
          <p className="text-sm text-muted">{t("approvals.autoHint")}</p>
        </div>
        <FlagToggle
          flagKey="auto_approve_registrations"
          enabled={data.auto_approve}
          label={t("approvals.autoTitle")}
        />
      </section>
      {total === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title={t("approvals.empty")}
          description={t("approvals.emptyHint")}
        />
      ) : (
        <>
          {data.shops.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-bold text-ink">
                {t("approvals.dukans", { count: data.shops.length })}
              </h2>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {data.shops.map((shop) => (
                  <WaitingCard key={shop.id} item={shop} target="shop" signed={signed} />
                ))}
              </ul>
            </section>
          ) : null}
          {data.orgs.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-bold text-ink">
                {t("approvals.distributors", { count: data.orgs.length })}
              </h2>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {data.orgs.map((org) => (
                  <WaitingCard key={org.id} item={org} target="org" signed={signed} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </AdminPageShell>
  );
}

/** Dukans and distributors waiting for approval, with the auto-approve switch. */
export function AdminApprovalsPage() {
  return (
    <Suspense
      fallback={
        <AdminPageShell>
          <Skeleton className="h-10 w-48 rounded-md" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </AdminPageShell>
      }
    >
      <ApprovalsContent />
    </Suspense>
  );
}
