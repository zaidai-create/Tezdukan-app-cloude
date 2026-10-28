import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InboxPage } from "@/features/distributor/orders/inbox-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("orders") };
}

export default function Page(props: PageProps<"/[locale]/distributor/orders">) {
  return <InboxPage searchParams={props.searchParams} />;
}
