import { ChevronRight, History, LifeBuoy, Truck, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { AdminHeader, AdminPageShell, ListCard } from "../components/admin-ui";
import { FlagToggle } from "../components/flag-toggle";
import { getFlags } from "../data";

const knownFlags = ["auto_approve_registrations", "sindhi_ui"] as const;
type KnownFlag = (typeof knownFlags)[number];
const isKnown = (key: string): key is KnownFlag => (knownFlags as readonly string[]).includes(key);

async function SettingsContent() {
  await connection();
  await requireRole("admin", "/admin/settings");
  const [t, flags] = await Promise.all([getTranslations("admin"), getFlags()]);
  const more = [
    { href: "/admin/distributors", icon: Truck, label: t("settings.distributors") },
    { href: "/admin/users", icon: Users, label: t("settings.users") },
    { href: "/admin/support", icon: LifeBuoy, label: t("settings.support") },
    { href: "/admin/audit", icon: History, label: t("settings.audit") },
  ];
  return (
    <AdminPageShell>
      <AdminHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold text-ink">{t("settings.switches")}</h2>
        <ListCard label={t("settings.switches")}>
          {flags.map((flag) => {
            const title = isKnown(flag.key) ? t(`flags.${flag.key}.title`) : flag.key;
            const hint = isKnown(flag.key) ? t(`flags.${flag.key}.hint`) : flag.description;
            return (
              <li key={flag.key} className="flex items-center gap-4 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{title}</span>
                  {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
                </span>
                <FlagToggle flagKey={flag.key} enabled={flag.enabled} label={title} />
              </li>
            );
          })}
        </ListCard>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-bold text-ink">{t("settings.more")}</h2>
        <ListCard label={t("settings.more")}>
          {more.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex min-h-14 items-center gap-3 px-4">
                <span className="flex size-10 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
                  <item.icon aria-hidden className="size-5" strokeWidth={1.75} />
                </span>
                <span className="flex-1 font-semibold text-ink">{item.label}</span>
                <ChevronRight aria-hidden className="size-4 text-muted rtl:-scale-x-100" />
              </Link>
            </li>
          ))}
        </ListCard>
      </section>
    </AdminPageShell>
  );
}

/** App switches and the screens that do not fit in the phone's bottom bar. */
export function AdminSettingsPage() {
  return (
    <Suspense
      fallback={
        <AdminPageShell>
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </AdminPageShell>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
