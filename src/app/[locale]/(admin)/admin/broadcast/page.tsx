import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminBroadcastPage } from "@/features/admin/pages/broadcast-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.broadcast");
  return { title: t("title") };
}

export default function Page() {
  return <AdminBroadcastPage />;
}
