import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChatListPage } from "@/features/chat/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("title") };
}

export default function Page() {
  return <ChatListPage area="dukan" />;
}
