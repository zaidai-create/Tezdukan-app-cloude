import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MyOrderPage } from "@/features/customer-orders/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("customerOrders");
  return { title: t("title") };
}

export default function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MyOrderPage params={props.params} searchParams={props.searchParams} />;
}
