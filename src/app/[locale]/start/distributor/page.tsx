import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RegisterPage } from "@/features/onboarding/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding.form");
  return { title: t("distributorTitle") };
}

export default function Page() {
  return <RegisterPage kind="distributor" />;
}
