import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/features/legal/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.refund");
  return { title: t("title") };
}

export default function Page() {
  return <LegalPage doc="refund" />;
}
