import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export type LegalDoc = "terms" | "privacy" | "refund";

const sections = {
  terms: ["terms.s1", "terms.s2", "terms.s3", "terms.s4", "terms.s5", "terms.s6"],
  privacy: ["privacy.s1", "privacy.s2", "privacy.s3", "privacy.s4", "privacy.s5"],
  refund: ["refund.s1", "refund.s2", "refund.s3"],
} as const;

/** Terms, privacy and refund policy: short, plain-language pages linked from Account. */
export async function LegalPage({ doc }: { doc: LegalDoc }) {
  const t = await getTranslations("legal");
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
          <div>
            <h1 className="font-heading text-2xl font-bold text-ink">{t(`${doc}.title`)}</h1>
            <p className="text-sm text-muted">{t("updated")}</p>
          </div>
        </header>
        <div className="flex flex-col divide-y divide-border/70 rounded-lg border border-border/60 bg-surface shadow-card">
          {sections[doc].map((section) => (
            <section key={section} className="flex flex-col gap-1 p-4">
              <h2 className="font-heading text-lg font-semibold text-ink">
                {t(`${section}.title`)}
              </h2>
              <p className="text-base text-ink/80">{t(`${section}.body`)}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
