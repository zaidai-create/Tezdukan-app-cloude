import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Awning } from "@/components/brand/awning";
import { Logo, LogoMark, Wordmark } from "@/components/brand/logo";
import { OfflineBanner } from "@/components/states/offline-banner";
import { LanguageChips } from "@/features/auth/components/language-chips";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("auth");
  const brand = await getTranslations("brand");
  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      {/* Brand panel (desktop): the logo as it was drawn, on black. */}
      <aside className="relative hidden w-[44%] max-w-[640px] flex-col overflow-hidden border-e border-border bg-brand-panel text-on-brand-panel lg:flex">
        <Awning height={34} stripe={36} />
        <div className="flex flex-1 flex-col justify-between gap-12 p-12">
          {/* Same composition as the logo artwork: the mark centred over the wordmark. */}
          <div className="flex flex-col items-center gap-4 self-start">
            <LogoMark variant="bare" className="h-auto w-52" />
            <div className="flex flex-col items-center gap-2.5">
              <Wordmark tone="onDark" className="h-12" />
              <p className="text-base text-on-brand-panel/85 ltr:tracking-[0.08em]">
                {brand("tagline")}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <p className="max-w-md font-heading text-3xl leading-tight font-semibold">
              {t("panelTitle")}
            </p>
            <ul className="flex flex-col gap-3 text-base text-on-brand-panel/80">
              <li>{t("panelPoint1")}</li>
              <li>{t("panelPoint2")}</li>
              <li>{t("panelPoint3")}</li>
            </ul>
          </div>
          <p className="text-sm text-on-brand-panel/60">{t("panelFooter")}</p>
        </div>
      </aside>

      {/* Form column */}
      <div className="flex flex-1 flex-col">
        <OfflineBanner />
        <div className="lg:hidden">
          <Awning height={16} stripe={20} />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-6 pb-10 lg:justify-center lg:pt-10">
          <div className="mb-6 flex flex-col gap-5">
            <Logo className="lg:hidden" markClassName="size-11" wordmarkClassName="h-6" />
            <LanguageChips />
          </div>
          <main id="main" className="flex flex-col">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
