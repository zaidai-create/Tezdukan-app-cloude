import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OnlineDukanPage } from "@/features/online-dukan/online-dukan-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onlineDukan");
  return { title: t("title") };
}

export default function Page() {
  return <OnlineDukanPage />;
}
