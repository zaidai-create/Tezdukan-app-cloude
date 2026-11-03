import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductsPage } from "@/features/shop-products/products-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("products") };
}

export default function Page() {
  return <ProductsPage />;
}
