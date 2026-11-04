import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminOrdersPage } from "@/features/admin/pages/orders-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.orders");
  return { title: t("title") };
}

export default function Page({ searchParams }: PageProps<"/[locale]/admin/orders">) {
  return <AdminOrdersPage searchParams={searchParams} />;
}
