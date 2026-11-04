import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminApprovalsPage } from "@/features/admin/pages/approvals-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.approvals");
  return { title: t("title") };
}

export default function Page() {
  return <AdminApprovalsPage />;
}
