import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StartChooser } from "@/features/onboarding/components/start-chooser";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title") };
}

export default function Page() {
  return (
    <main>
      <StartChooser />
    </main>
  );
}
