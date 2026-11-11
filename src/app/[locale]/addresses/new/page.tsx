import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AddressEditorPage } from "@/features/addresses/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("addresses");
  return { title: t("addTitle") };
}

export default function Page({ searchParams }: PageProps<"/[locale]/addresses/new">) {
  return <AddressEditorPage searchParams={searchParams} />;
}
