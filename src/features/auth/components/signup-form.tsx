"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormHint,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { signUpAction } from "../session-actions";
import { useFormError } from "../use-form-error";
import { signupSchema, type SignupValues } from "../schemas";
import { FormAlert } from "./form-alert";
import { GoogleButton } from "./google-button";
import { PasswordInput } from "./password-input";
import { PhoneInput } from "./phone-input";

function SignupForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useFormError<{ message: string; signIn?: boolean }>();
  const [leaving, setLeaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", phone: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await signUpAction(values);
        if (result.ok) {
          setLeaving(true);
          router.push(`/verify?${new URLSearchParams({ phone: result.phone, mode: "signup" })}`);
          return;
        }
        setError({
          message: t(`errors.${result.error}`),
          signIn: result.error === "phoneTaken",
        });
      } catch {
        setError({ message: t("errors.network") });
      }
    }),
  );

  return (
    <Form {...form}>
      <div className="mb-5 flex flex-col gap-4">
        <GoogleButton />
      </div>
      {/* POST: a tap before the page has hydrated must not put
          the password in the URL. */}
      <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("nameLabel")}</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder={t("namePlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("phoneLabel")}</FormLabel>
              <FormControl>
                <PhoneInput placeholder={t("phonePlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newPasswordLabel")}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormHint>{t("newPasswordHint")}</FormHint>
              <FormMessage />
            </FormItem>
          )}
        />
        {error ? (
          <FormAlert key={error.attempt}>
            {error.value.message}{" "}
            {error.value.signIn ? (
              <Link href="/login" className="font-semibold underline underline-offset-4">
                {t("signIn")}
              </Link>
            ) : null}
          </FormAlert>
        ) : null}
        <Button type="submit" size="lg" block loading={pending || leaving}>
          {t("signUp")}
        </Button>
        <p className="text-center text-sm text-muted">{t("termsNote")}</p>
        <p className="text-center text-base text-muted">
          {t("haveAccount")}{" "}
          <Link
            href="/login"
            className="font-semibold text-primary-strong underline-offset-4 hover:underline"
          >
            {t("signIn")}
          </Link>
        </p>
      </form>
    </Form>
  );
}

export { SignupForm };
