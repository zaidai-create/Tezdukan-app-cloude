import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RegistrationStatusPage } from "@/features/onboarding/status-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("applications");
  return { title: t("title") };
}

export default function Page({ searchParams }: PageProps<"/[locale]/register/status">) {
  return <RegistrationStatusPage sent={searchParams.then((query) => query.sent === "1")} />;
}
