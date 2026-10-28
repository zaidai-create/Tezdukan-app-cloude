import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OpenChatPage } from "@/features/chat/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("title") };
}

export default function Page(props: PageProps<"/[locale]/distributor/chat/with/[id]">) {
  return <OpenChatPage area="distributor" with={props.params.then((p) => p.id)} />;
}
