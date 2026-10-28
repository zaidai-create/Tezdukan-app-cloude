import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WelcomeScreen } from "@/features/welcome/welcome-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("welcome");
  return { title: t("title") };
}

export default function Page() {
  return <WelcomeScreen />;
}
