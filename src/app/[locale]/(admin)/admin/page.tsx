import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminOverviewPage } from "@/features/admin/pages/overview-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.overview");
  return { title: t("title") };
}

export default function Page({ searchParams }: PageProps<"/[locale]/admin">) {
  return <AdminOverviewPage searchParams={searchParams} />;
}
