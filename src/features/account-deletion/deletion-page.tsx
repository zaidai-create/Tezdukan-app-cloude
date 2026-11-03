import { ArrowLeft, CircleCheck, Clock3, MessageCircle } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { getShellSession } from "@/lib/auth/session";
import { whatsappHref } from "@/lib/contact";
import { publicEnv } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DeletionForm } from "./components/deletion-form";

const openRequestSchema = z
  .object({ id: z.uuid(), status: z.string(), created_at: z.string() })
  .nullable();

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function DeletionState({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const done = (await searchParams).done === "1";
  const [t, format, session] = await Promise.all([
    getTranslations("dataDeletion"),
    getFormatter(),
    getShellSession(),
  ]);
  const whatsapp = whatsappHref(publicEnv.NEXT_PUBLIC_SUPPORT_WHATSAPP, t("whatsappText"));

  if (done) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-lg bg-primary-soft p-6 text-center">
        <CircleCheck aria-hidden className="size-10 text-primary-strong" />
        <h2 className="font-heading text-xl font-bold text-ink">{t("doneTitle")}</h2>
        <p className="text-sm text-ink">{t("doneBody")}</p>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border/70 bg-surface p-4 shadow-card">
        <h2 className="font-heading text-lg font-bold text-ink">{t("signedOutTitle")}</h2>
        <p className="text-sm text-muted">{t("signedOutBody")}</p>
        <Link href="/login?next=/data-deletion" className={buttonVariants({ block: true })}>
          {t("signIn")}
        </Link>
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "secondary", block: true })}
          >
            <MessageCircle aria-hidden />
            {t("whatsapp")}
          </a>
        ) : null}
      </section>
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.rpc("my_account_deletion");
  const open = openRequestSchema.catch(null).parse(data ?? null);
  if (open) {
    return (
      <section className="flex items-start gap-3 rounded-lg bg-awning-soft p-4">
        <Clock3 aria-hidden className="mt-0.5 size-6 shrink-0 text-awning-ink" />
        <div>
          <h2 className="font-heading text-lg font-bold text-ink">
            {t("requestedTitle", {
              date: format.dateTime(new Date(open.created_at), {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                timeZone: "Asia/Karachi",
              }),
            })}
          </h2>
          <p className="text-sm text-ink">{t("requestedBody")}</p>
        </div>
      </section>
    );
  }
  return <DeletionForm />;
}

/** /data-deletion: how to delete a TezDukan account, and the request itself when signed in. */
export async function DataDeletionPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("dataDeletion");
  const deleted = ["profile", "phone", "addresses", "cart", "chats", "devices"] as const;
  const kept = ["orders", "khata"] as const;
  return (
    <main className="min-h-dvh bg-canvas">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-5 pb-12">
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
        <p className="text-base text-ink">{t("intro")}</p>

        <section className="flex flex-col gap-2 rounded-lg border border-border/70 bg-surface p-4 shadow-card">
          <h2 className="font-heading text-base font-bold text-ink">{t("deletedTitle")}</h2>
          <ul className="list-disc ps-5 text-sm text-ink">
            {deleted.map((key) => (
              <li key={key}>{t(`deleted.${key}`)}</li>
            ))}
          </ul>
          <h2 className="mt-2 font-heading text-base font-bold text-ink">{t("keptTitle")}</h2>
          <ul className="list-disc ps-5 text-sm text-ink">
            {kept.map((key) => (
              <li key={key}>{t(`kept.${key}`)}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">{t("timeline")}</p>
        </section>

        <Suspense fallback={<Skeleton className="h-56 w-full rounded-lg" />}>
          <DeletionState searchParams={searchParams} />
        </Suspense>
      </article>
    </main>
  );
}
