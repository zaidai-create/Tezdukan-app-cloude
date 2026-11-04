import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminAuditPage } from "@/features/admin/pages/audit-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.audit");
  return { title: t("title") };
}

export default function Page() {
  return <AdminAuditPage />;
}
