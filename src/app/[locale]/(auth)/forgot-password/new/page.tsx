import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthFormSkeleton, AuthHeading } from "@/features/auth/components/auth-heading";
import { NewPasswordForm } from "@/features/auth/components/new-password-form";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("newPasswordTitle") };
}

export default async function NewPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("newPasswordTitle")} />
      <Suspense fallback={<AuthFormSkeleton fields={1} />}>
        <RequireRecoverySession />
      </Suspense>
    </>
  );
}

/** Only reachable right after verifying the reset code (which signs the person in). */
async function RequireRecoverySession() {
  await connection();
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/forgot-password");
  return <NewPasswordForm />;
}
