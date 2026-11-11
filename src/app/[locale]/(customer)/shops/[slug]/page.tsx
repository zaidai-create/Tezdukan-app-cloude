import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShopPage } from "@/features/storefront/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.shops");
  return { title: t("title") };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/shops/[slug]">) {
  return <ShopPage params={params} searchParams={searchParams} />;
}
