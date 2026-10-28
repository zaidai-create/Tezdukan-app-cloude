import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductFormPage } from "@/features/catalog/catalog-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog.form");
  return { title: t("editTitle") };
}

export default function Page(props: PageProps<"/[locale]/distributor/catalog/[id]">) {
  return <ProductFormPage params={props.params} />;
}
