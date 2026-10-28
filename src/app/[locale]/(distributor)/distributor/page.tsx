import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DistributorDashboard } from "@/features/distributor/dashboard/dashboard-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

export default function Page() {
  return <DistributorDashboard />;
}
