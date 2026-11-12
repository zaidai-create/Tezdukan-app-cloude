import { BadgeCheck, MapPin, MessageSquareShare, Phone } from "lucide-react";
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
import { KycDocuments } from "../components/kyc-documents";
import { TimeAgo } from "../components/time-ago";
import { getApprovals, signKycDocuments } from "../data";
import type { Approvals } from "../schemas";

type Waiting = Approvals["shops"][number] | Approvals["orgs"][number];

/** The registration's documents with short-lived links to the photos. */
function Documents({ item, signed }: { item: Waiting; signed: Map<string, string> }) {
  const documents = item.documents;
  return (
    <KycDocuments
      documents={
        documents
          ? {
              cnicNumber: documents.cnic_number,
              ntn: item.ntn ?? null,
              strn: item.strn ?? null,
              front: signed.get(documents.cnic_front_path) ?? null,
              back: signed.get(documents.cnic_back_path) ?? null,
              place: signed.get(documents.place_photo_path) ?? null,
            }
          : null
      }
    />
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
