import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StorefrontSearchPage } from "@/features/storefront/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.search");
  return { title: t("title") };
}

export default function Page({ searchParams }: PageProps<"/[locale]/search">) {
  return <StorefrontSearchPage searchParams={searchParams} />;
}
