"use client";

import { cn } from "cn";
import { ChevronRight, MessageSquareShare, Phone, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { telHref, whatsappHref } from "@/lib/contact";
import { formatDate } from "@/lib/format";
import { formatRs } from "@/lib/money";
import { formatPkMobile } from "@/lib/phone";
import type { Target } from "../actions";
import { entityColumns } from "./columns";
import { DeliveryControl } from "./delivery-control";
import { EntityActions } from "./entity-actions";

export type EntitySummary = {
  target: Target;
  id: string;
  name: string;
  status: string;
  area: string | null;
  address: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  phone: string | null;
  reason: string | null;
  createdAt: string;
  products: number;
  orders30d: number;
  sales30d: number;
  live?: boolean;
  rating?: number | null;
  ratingCount?: number;
  dukans30d?: number;
  radiusM?: number;
  allCity?: boolean;
  hasPin?: boolean;
};

const tone: Record<string, StatusTone> = {
  approved: "success",
  pending: "warning",
  suspended: "danger",
  rejected: "neutral",
};

/** One dukan or distributor in a list; tap for details, contact and actions. */
export function EntityRow({ entity, canEdit }: { entity: EntitySummary; canEdit: boolean }) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const contactPhone = entity.ownerPhone ?? entity.phone;
  const tel = telHref(contactPhone);
  const wa = whatsappHref(contactPhone);
  const owner = [entity.ownerName, contactPhone ? formatPkMobile(contactPhone) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-start transition-colors duration-150 ease-out hover:bg-subtle/60 lg:grid lg:gap-4",
          entityColumns,
        )}
      >
        {/* Wide screen: one table row. */}
        <span className="hidden min-w-0 items-center gap-3 lg:flex">
          <Avatar className="size-9 shrink-0 rounded-md">
            <AvatarFallback name={entity.name} className="rounded-md text-xs" />
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{entity.name}</span>
            <span className="block truncate text-sm text-muted">{owner}</span>
          </span>
        </span>
        <span className="hidden truncate text-sm text-ink lg:block">{entity.area ?? "—"}</span>
        <span className="hidden items-center gap-2 lg:flex">
          <StatusBadge tone={tone[entity.status] ?? "neutral"} icon={null}>
            {t(`status.${entity.status}` as "status.pending")}
          </StatusBadge>
          {entity.live !== undefined ? (
            <span
              title={entity.live ? t("list.online") : t("list.offline")}
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                entity.live ? "bg-primary" : "bg-border-strong",
              )}
            />
          ) : null}
        </span>
        <span className="num hidden text-sm text-ink lg:block">
          <span className="sr-only">{t("list.products")}: </span>
          {entity.products}
        </span>
        <span className="num hidden text-sm text-ink lg:block">
          <span className="sr-only">{t("list.orders30")}: </span>
          {entity.orders30d}
        </span>
        <span className="num hidden text-sm font-bold text-ink lg:block">
          <span className="sr-only">{t("list.sales30")}: </span>
          {formatRs(entity.sales30d)}
        </span>
        <span className="num hidden text-sm text-muted lg:block">
          {formatDate(entity.createdAt)}
        </span>
        <ChevronRight
          aria-hidden
          className="hidden size-4 shrink-0 text-muted lg:block rtl:-scale-x-100"
        />

        {/* Phone: a compact row. */}
        <Avatar className="size-11 shrink-0 rounded-md lg:hidden">
          <AvatarFallback name={entity.name} className="rounded-md" />
        </Avatar>
        <span className="min-w-0 flex-1 lg:hidden">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink">{entity.name}</span>
            {entity.status !== "approved" ? (
              <StatusBadge tone={tone[entity.status] ?? "neutral"} icon={null}>
                {t(`status.${entity.status}` as "status.pending")}
              </StatusBadge>
            ) : null}
          </span>
          <span className="block truncate text-sm text-muted">
            {[owner, entity.area].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 lg:hidden">
          <span className="num text-sm font-bold text-ink">{formatRs(entity.sales30d)}</span>
          <span className="num text-xs text-muted">
            {t("list.orders", { count: entity.orders30d })}
          </span>
        </span>
        {entity.live !== undefined ? (
          <span
            aria-label={entity.live ? t("list.online") : t("list.offline")}
            className={cn(
              "size-2.5 shrink-0 rounded-full lg:hidden",
              entity.live ? "bg-primary" : "bg-border-strong",
            )}
          />
        ) : null}
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted lg:hidden rtl:-scale-x-100"
        />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{entity.name}</SheetTitle>
            <SheetDescription>
              {entity.target === "shop" ? t("list.dukan") : t("list.distributor")}
              {" · "}
              {t(`status.${entity.status}` as "status.pending")}
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-subtle p-3">
                <dt className="text-sm text-muted">{t("list.sales30")}</dt>
                <dd className="num font-heading text-lg font-bold text-ink">
                  {formatRs(entity.sales30d)}
                </dd>
              </div>
              <div className="rounded-md bg-subtle p-3">
                <dt className="text-sm text-muted">{t("list.orders30")}</dt>
                <dd className="num font-heading text-lg font-bold text-ink">{entity.orders30d}</dd>
              </div>
              <div className="rounded-md bg-subtle p-3">
                <dt className="text-sm text-muted">{t("list.products")}</dt>
                <dd className="num font-heading text-lg font-bold text-ink">{entity.products}</dd>
              </div>
              {entity.target === "shop" ? (
                <div className="rounded-md bg-subtle p-3">
                  <dt className="text-sm text-muted">{t("list.rating")}</dt>
                  <dd className="num flex items-center gap-1 font-heading text-lg font-bold text-ink">
                    {entity.rating ? (
                      <>
                        <Star aria-hidden className="size-4 fill-awning text-awning" />
                        {entity.rating.toFixed(1)}
                        <span className="text-sm font-medium text-muted">
                          {t("list.ratingCount", { count: entity.ratingCount ?? 0 })}
                        </span>
                      </>
                    ) : (
                      t("list.noRating")
                    )}
                  </dd>
                </div>
              ) : (
                <div className="rounded-md bg-subtle p-3">
                  <dt className="text-sm text-muted">{t("list.dukans30")}</dt>
                  <dd className="num font-heading text-lg font-bold text-ink">
                    {entity.dukans30d ?? 0}
                  </dd>
                </div>
              )}
            </dl>
            <ul className="flex flex-col gap-1.5 text-sm text-ink">
              {owner ? <li>{t("list.owner", { owner })}</li> : null}
              {entity.address || entity.area ? (
                <li>{[entity.address, entity.area].filter(Boolean).join(", ")}</li>
              ) : null}
              {entity.live !== undefined ? (
                <li>{entity.live ? t("list.takesOrders") : t("list.noOrders")}</li>
              ) : null}
              <li className="num text-muted">
                {t("list.joined", { date: formatDate(entity.createdAt) })}
              </li>
              {entity.reason ? (
                <li className="rounded-md bg-danger-soft px-3 py-2 text-danger-ink">
                  {t("list.reason", { reason: entity.reason })}
                </li>
              ) : null}
            </ul>
            {tel || wa ? (
              <div className="grid grid-cols-2 gap-2">
                {tel ? (
                  <a
                    href={tel}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary-soft font-semibold text-primary-strong"
                  >
                    <Phone aria-hidden className="size-5" strokeWidth={1.75} />
                    {t("list.call")}
                  </a>
                ) : null}
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary-soft font-semibold text-primary-strong"
                  >
                    <MessageSquareShare aria-hidden className="size-5" strokeWidth={1.75} />
                    {t("list.whatsapp")}
                  </a>
                ) : null}
              </div>
            ) : null}
            {entity.target === "shop" && entity.radiusM !== undefined ? (
              <DeliveryControl
                shopId={entity.id}
                radiusM={entity.radiusM}
                allCity={entity.allCity ?? false}
                hasPin={entity.hasPin ?? false}
                canEdit={canEdit}
              />
            ) : null}
            {canEdit ? (
              <EntityActions
                target={entity.target}
                id={entity.id}
                status={entity.status}
                onDone={() => setOpen(false)}
              />
            ) : null}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </li>
  );
}
