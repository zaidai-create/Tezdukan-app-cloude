"use client";

import { cn } from "cn";
import {
  BadgeCheck,
  Bell,
  Boxes,
  type LucideIcon,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  Package,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ListRowSkeleton } from "@/components/states/skeletons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRouter } from "@/i18n/navigation";
import { useMarkNotificationsRead, useNotifications, useUnreadNotifications } from "../queries";
import type { AppNotification, NotificationKind, NotificationScope } from "../schemas";
import { notificationText } from "../text";
import { PushToggle } from "./push-toggle";

const kindIcon: Record<NotificationKind, LucideIcon> = {
  order: Package,
  delivery: Truck,
  payment: Wallet,
  khata: Wallet,
  stock: Boxes,
  brief: Sparkles,
  approval: BadgeCheck,
  promotion: Megaphone,
  support: LifeBuoy,
  chat: MessageCircle,
  system: Bell,
};

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
}) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const Icon = kindIcon[notification.kind];
  const text = notificationText(t, notification);
  const unread = notification.read_at === null;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className={cn(
          "flex w-full gap-3 rounded-lg p-3 text-start transition-colors hover:bg-subtle",
          unread && "bg-primary-soft/50",
        )}
      >
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full",
            unread ? "bg-action text-on-action" : "bg-subtle text-muted",
          )}
        >
          <Icon aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className={cn("text-sm text-ink", unread ? "font-bold" : "font-semibold")}>
              {text.title}
            </span>
            {unread ? (
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-danger" />
            ) : null}
          </span>
          {text.body ? (
            <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{text.body}</span>
          ) : null}
          <span className="num mt-1 block text-xs text-muted">
            {format.relativeTime(new Date(notification.created_at), now)}
          </span>
        </span>
      </button>
    </li>
  );
}

function NotificationList({
  scope,
  onNavigate,
}: {
  scope: NotificationScope;
  onNavigate: () => void;
}) {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const list = useNotifications(scope, true);
  const markRead = useMarkNotificationsRead(scope);
  const hasUnread = (list.data ?? []).some((n) => n.read_at === null);

  const open = (notification: AppNotification) => {
    if (notification.read_at === null) markRead.mutate([notification.id]);
    if (notification.link) {
      onNavigate();
      router.push(notification.link);
    }
  };

  return (
    <>
      <SheetHeader className="flex-row items-center justify-between gap-3">
        <SheetTitle>{t("title")}</SheetTitle>
        {hasUnread ? (
          <Button size="sm" variant="ghost" onClick={() => markRead.mutate("all")}>
            {t("markAllRead")}
          </Button>
        ) : null}
      </SheetHeader>
      <SheetBody className="flex flex-col gap-4 pb-6">
        {list.isPending ? (
          <div aria-hidden>
            <ListRowSkeleton />
            <ListRowSkeleton />
            <ListRowSkeleton />
          </div>
        ) : list.isError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-muted">{t("error")}</p>
            <Button size="sm" variant="secondary" onClick={() => void list.refetch()}>
              {tCommon("retry")}
            </Button>
          </div>
        ) : list.data.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t("empty")}
            description={t("emptyHint")}
            className="py-4"
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {list.data.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} onOpen={open} />
            ))}
          </ul>
        )}
        <PushToggle />
      </SheetBody>
    </>
  );
}

/** Header bell with the unread count; opens the notification centre for the active context. */
export function NotificationBell({
  scope,
  className,
}: {
  scope: NotificationScope;
  className?: string;
}) {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const unread = useUnreadNotifications(scope).data ?? 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-subtle",
          className,
        )}
      >
        <Bell aria-hidden className="size-[22px]" strokeWidth={1.75} />
        <span className="sr-only">
          {t("title")}
          {unread > 0 ? `, ${t("unread", { count: unread })}` : ""}
        </span>
        {unread > 0 ? (
          <span
            aria-hidden
            className="num absolute end-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] leading-none font-bold text-on-danger ring-2 ring-surface"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      <SheetContent side={desktop ? "end" : "bottom"} aria-describedby={undefined}>
        <NotificationList scope={scope} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
