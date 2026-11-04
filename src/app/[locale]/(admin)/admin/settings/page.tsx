import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminSettingsPage } from "@/features/admin/pages/settings-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings");
  return { title: t("title") };
}

export default function Page() {
  return <AdminSettingsPage />;
}
