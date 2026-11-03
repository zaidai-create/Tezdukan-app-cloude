import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DataDeletionPage } from "@/features/account-deletion/deletion-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dataDeletion");
  return { title: t("title") };
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Read inside the page's Suspense boundary, so the static shell still prerenders.
  return <DataDeletionPage searchParams={searchParams} />;
}
