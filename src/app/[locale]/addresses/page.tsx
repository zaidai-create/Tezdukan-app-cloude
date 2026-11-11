import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AddressesPage } from "@/features/addresses/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("addresses");
  return { title: t("title") };
}

export default function Page({ searchParams }: PageProps<"/[locale]/addresses">) {
  return <AddressesPage searchParams={searchParams} />;
}
