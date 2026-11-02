import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShopPage } from "@/features/storefront/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.shops");
  return { title: t("title") };
}

export default function Page(props: { params: Promise<{ slug: string }> }) {
  return <ShopPage params={props.params} />;
}
