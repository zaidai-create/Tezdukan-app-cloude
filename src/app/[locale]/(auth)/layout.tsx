import { Mic, ReceiptText, Truck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Awning } from "@/components/brand/awning";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { OfflineBanner } from "@/components/states/offline-banner";
import { AuthTransition } from "@/features/auth/components/auth-transition";
import { LanguageChips } from "@/features/auth/components/language-chips";
import { localeDir } from "@/i18n/locales";

const panelPoints = [
  { key: "panelPoint1", icon: Truck },
  { key: "panelPoint2", icon: ReceiptText },
  { key: "panelPoint3", icon: Mic },
] as const;

/**
 * The auth screens as a shopfront: the logo assembles itself on a black signboard, the awning
 * hangs below it, and the form sits under the awning like the counter. On desktop the
 * signboard is a side panel that also says what TezDukan does for a dukandar.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("auth");
  const brand = await getTranslations("brand");
  // The lockup is brand artwork and stays left to right; the tagline follows the language.
  const taglineDir = localeDir(await getLocale());
  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      {/* Desktop signboard */}
      <aside className="relative hidden w-[44%] max-w-[640px] flex-col overflow-hidden border-e border-border bg-brand-panel text-on-brand-panel lg:flex">
        <Awning animated height={34} stripe={36} />
        <div className="flex flex-1 flex-col justify-between gap-12 p-12">
          {/* Same composition as the logo artwork: the mark centred over the wordmark. */}
          <div data-logo-reveal className="flex flex-col items-center gap-4 self-start">
            <LogoMark variant="bare" className="h-auto w-52" />
            <div className="flex flex-col items-center gap-2.5">
              <Wordmark data-part="wordmark" tone="onDark" className="h-12" />
              <p
                data-part="tagline"
                dir={taglineDir}
                className="text-base text-on-brand-panel/85 ltr:tracking-[0.08em]"
              >
                {brand("tagline")}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <p
              className="max-w-md animate-rise font-heading text-3xl leading-tight font-semibold"
              style={{ animationDelay: "900ms" }}
            >
              {t("panelTitle")}
            </p>
            <ul className="flex flex-col gap-4">
              {panelPoints.map(({ key, icon: Icon }, index) => (
                <li
                  key={key}
                  className="flex animate-rise items-center gap-3.5 text-base text-on-brand-panel/85"
                  style={{ animationDelay: `${1000 + index * 90}ms` }}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-on-brand-panel/10 text-mint">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-on-brand-panel/60">{t("panelFooter")}</p>
        </div>
      </aside>

      {/* Mobile signboard, with the awning hanging below it */}
      <header data-logo-reveal className="bg-brand-panel text-on-brand-panel lg:hidden">
        <div className="pt-safe">
          <div className="flex px-5 pt-5 pb-4">
            <div dir="ltr" className="flex min-w-0 items-center gap-3.5">
              <LogoMark variant="bare" className="h-12 w-auto" />
              <div className="flex min-w-0 flex-col items-start gap-1.5">
                <Wordmark data-part="wordmark" tone="onDark" className="h-6" />
                <p
                  data-part="tagline"
                  dir={taglineDir}
                  className="text-sm text-on-brand-panel/80 ltr:tracking-[0.04em]"
                >
                  {brand("tagline")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="lg:hidden">
        <Awning animated height={16} stripe={20} />
      </div>

      {/* The counter: language first, then the form */}
      <div className="flex flex-1 flex-col">
        <OfflineBanner />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-5 pb-10 lg:justify-center lg:pt-10">
          <LanguageChips className="mb-6" />
          <main id="main" className="flex flex-col">
            <AuthTransition>{children}</AuthTransition>
          </main>
        </div>
      </div>
    </div>
  );
}
