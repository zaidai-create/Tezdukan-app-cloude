import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminDirectoryPage } from "@/features/admin/pages/directory-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.directory");
  return { title: t("orgsTitle") };
}

export default function Page({ searchParams }: PageProps<"/[locale]/admin/distributors">) {
  return <AdminDirectoryPage kind="distributors" searchParams={searchParams} />;
}
