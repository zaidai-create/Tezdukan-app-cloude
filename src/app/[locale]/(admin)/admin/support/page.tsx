import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SupportQueuePage } from "@/features/chat/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat.queue");
  return { title: t("title") };
}

export default function Page() {
  return <SupportQueuePage />;
}
