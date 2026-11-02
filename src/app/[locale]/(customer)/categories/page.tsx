import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StorefrontCategoriesPage } from "@/features/storefront/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("storefront.categories");
  return { title: t("title") };
}

export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <StorefrontCategoriesPage searchParams={props.searchParams} />;
}
