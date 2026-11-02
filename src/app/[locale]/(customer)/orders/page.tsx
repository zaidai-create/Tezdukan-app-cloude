import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MyOrdersPage } from "@/features/customer-orders/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("customerOrders");
  return { title: t("title") };
}

export default function Page() {
  return <MyOrdersPage />;
}
