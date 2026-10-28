import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OrgOrderPage } from "@/features/distributor/orders/order-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("orders") };
}

export default function Page(props: PageProps<"/[locale]/distributor/orders/[id]">) {
  return <OrgOrderPage params={props.params} />;
}
