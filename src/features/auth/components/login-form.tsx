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
import { loginSchema, type LoginValues } from "../schemas";
import { FormAlert } from "./form-alert";
import { PasswordInput } from "./password-input";
import { PhoneInput } from "./phone-input";

function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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
          router.replace(result.redirectTo);
          router.refresh();
          return;
        }
        if ("phone" in result) {
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
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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
        {error ? <FormAlert>{error}</FormAlert> : null}
        <Button type="submit" size="lg" block loading={pending}>
          {pending ? t("signingIn") : t("signIn")}
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
