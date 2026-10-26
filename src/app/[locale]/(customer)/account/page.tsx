import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountPage } from "@/features/account/account-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("account") };
}

export default function Page() {
  return <AccountPage />;
}
