import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CatalogPage } from "@/features/catalog/catalog-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog");
  return { title: t("title") };
}

export default function Page(props: PageProps<"/[locale]/distributor/catalog">) {
  return <CatalogPage searchParams={props.searchParams} />;
}
