import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChatThreadPage } from "@/features/chat/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat.queue");
  return { title: t("title") };
}

export default function Page(props: PageProps<"/[locale]/admin/support/[id]">) {
  return <ChatThreadPage area="admin" params={props.params} />;
}
