import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CustomerSupportPage } from "@/features/chat/pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("chat");
  return { title: t("support") };
}

export default function Page() {
  return <CustomerSupportPage />;
}
