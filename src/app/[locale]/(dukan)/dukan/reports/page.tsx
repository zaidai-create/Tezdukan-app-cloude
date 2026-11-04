import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShopReportPage } from "@/features/shop-report/report-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shopReport");
  return { title: t("title") };
}

export default function Page({ searchParams }: PageProps<"/[locale]/dukan/reports">) {
  return <ShopReportPage searchParams={searchParams} />;
}
