import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Awning } from "@/components/brand/awning";
import { Logo } from "@/components/brand/logo";
import { OfflineRetry } from "./offline-retry";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offlinePage");
  return { title: t("title") };
}

/** Precached by the service worker and served when a page cannot load without a network. */
export default async function OfflinePage() {
  const t = await getTranslations("offlinePage");
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Awning height={16} stripe={20} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
        <Logo markClassName="size-12" wordmarkClassName="h-6" />
        <h1 className="font-heading text-2xl font-semibold text-ink">{t("title")}</h1>
        <p className="text-base text-muted">{t("body")}</p>
        <OfflineRetry label={t("retry")} />
      </main>
    </div>
  );
}
