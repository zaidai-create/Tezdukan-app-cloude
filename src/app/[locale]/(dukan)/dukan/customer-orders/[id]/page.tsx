import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShopOrderPage } from "@/features/customer-orders/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("customerOrders");
  return { title: t("shopTitle") };
}

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <ShopOrderPage params={props.params} />;
}
