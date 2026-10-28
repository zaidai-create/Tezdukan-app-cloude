import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChatThreadPage } from "@/features/chat/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("title") };
}

export default function Page(props: PageProps<"/[locale]/dukan/chat/[id]">) {
  return <ChatThreadPage area="dukan" params={props.params} />;
}
