import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NearbyShopsPage } from "@/features/storefront/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.shops");
  return { title: t("title") };
}

export default function Page() {
  return <NearbyShopsPage />;
}
