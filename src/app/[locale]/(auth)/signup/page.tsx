import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { SignupForm } from "@/features/auth/components/signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signupTitle") };
}

export default async function SignupPage({ searchParams }: PageProps<"/[locale]/signup">) {
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("signupTitle")} subtitle={t("signupSubtitle")} />
      <Suspense fallback={<SignupForm />}>
        <SignupWithNext searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Keeps where the person was going (e.g. registering a dukan) through sign-up and the code. */
async function SignupWithNext({
  searchParams,
}: Pick<PageProps<"/[locale]/signup">, "searchParams">) {
  const { next } = await searchParams;
  return <SignupForm next={typeof next === "string" ? next : undefined} />;
}
