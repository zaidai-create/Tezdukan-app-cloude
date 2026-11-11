import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AddressEditorPage } from "@/features/addresses/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("addresses");
  return { title: t("editTitle") };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/addresses/[id]">) {
  return <AddressEditorPage params={params} searchParams={searchParams} />;
}
