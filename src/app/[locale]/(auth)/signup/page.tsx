import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { SignupForm } from "@/features/auth/components/signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signupTitle") };
}

export default async function SignupPage() {
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("signupTitle")} subtitle={t("signupSubtitle")} />
      <SignupForm />
    </>
  );
}
