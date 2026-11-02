import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CustomerCartPage } from "@/features/storefront/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.cart");
  return { title: t("title") };
}

export default function Page() {
  return <CustomerCartPage />;
}
