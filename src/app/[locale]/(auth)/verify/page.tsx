import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthFormSkeleton, AuthHeading } from "@/features/auth/components/auth-heading";
import { VerifyForm } from "@/features/auth/components/verify-form";
import { otpModeSchema } from "@/features/auth/schemas";
import { normalizePkMobile } from "@/lib/phone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("verifyTitle") };
}

export default async function VerifyPage({ searchParams }: PageProps<"/[locale]/verify">) {
  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("verifyTitle")} />
      <Suspense fallback={<AuthFormSkeleton fields={1} />}>
        <VerifyContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function VerifyContent({
  searchParams,
}: Pick<PageProps<"/[locale]/verify">, "searchParams">) {
  const params = await searchParams;
  const phone = typeof params.phone === "string" ? normalizePkMobile(params.phone) : null;
  const mode = otpModeSchema.safeParse(params.mode);
  if (!phone || !mode.success) redirect("/signup");
  return <VerifyForm phone={phone} mode={mode.data} />;
}
