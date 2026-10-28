import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OpenChatPage } from "@/features/chat/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("title") };
}

export default function Page() {
  return <OpenChatPage area="dukan" with={Promise.resolve(null)} />;
}
