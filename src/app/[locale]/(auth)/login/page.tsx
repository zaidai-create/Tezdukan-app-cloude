import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthFormSkeleton, AuthHeading } from "@/features/auth/components/auth-heading";
import { LoginForm } from "@/features/auth/components/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("loginTitle") };
}

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("loginTitle")} subtitle={t("loginSubtitle")} />
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginFormWithNext({
  searchParams,
}: Pick<PageProps<"/[locale]/login">, "searchParams">) {
  const { next, oauth } = await searchParams;
  return (
    <LoginForm
      next={typeof next === "string" ? next : undefined}
      oauthFailed={oauth === "failed"}
    />
  );
}
