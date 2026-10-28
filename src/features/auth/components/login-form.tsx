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
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Link, useRouter } from "@/i18n/navigation";
import { signInAction } from "../session-actions";
import { useFormError } from "../use-form-error";
import { loginSchema, type LoginValues } from "../schemas";
import { FormAlert } from "./form-alert";
import { GoogleButton } from "./google-button";
import { PasswordInput } from "./password-input";
import { PhoneInput } from "./phone-input";

function LoginForm({ next, oauthFailed = false }: { next?: string; oauthFailed?: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useFormError();
  // Stays true once signed in, so the button keeps working until the next screen arrives.
  const [leaving, setLeaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await signInAction(values, next);
        if (result.ok) {
          setLeaving(true);
          router.replace(result.redirectTo);
          router.refresh();
          return;
        }
        if ("phone" in result) {
          setLeaving(true);
          router.push(`/verify?${new URLSearchParams({ phone: result.phone, mode: "signup" })}`);
          return;
        }
        setError(t(`errors.${result.error}`));
      } catch {
        setError(t("errors.network"));
      }
    }),
  );

  return (
    <Form {...form}>
      <div className="mb-5 flex flex-col gap-4">
        {oauthFailed ? <FormAlert>{t("googleFailed")}</FormAlert> : null}
        <GoogleButton next={next} />
      </div>
      {/* POST: a tap before the page has hydrated must not put
          the password in the URL. */}
      <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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
              <div className="flex items-center justify-between">
                <FormLabel>{t("passwordLabel")}</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-sm font-semibold text-primary-strong underline-offset-4 hover:underline"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <FormControl>
                <PasswordInput
                  autoComplete="current-password"
                  placeholder={t("passwordPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error ? <FormAlert key={error.attempt}>{error.value}</FormAlert> : null}
        <Button type="submit" size="lg" block loading={pending || leaving}>
          {pending || leaving ? t("signingIn") : t("signIn")}
        </Button>
        <p className="text-center text-base text-muted">
          {t("noAccount")}{" "}
          <Link
            href="/signup"
            className="font-semibold text-primary-strong underline-offset-4 hover:underline"
          >
            {t("createAccount")}
          </Link>
        </p>
      </form>
    </Form>
  );
}

export { LoginForm };
