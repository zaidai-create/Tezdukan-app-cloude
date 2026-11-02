import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShopOrdersPage } from "@/features/customer-orders/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("customerOrders");
  return { title: t("shopTitle") };
}

export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ShopOrdersPage searchParams={props.searchParams} />;
}
