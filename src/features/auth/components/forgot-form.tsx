"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
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
import { requestPasswordResetAction } from "../session-actions";
import { useFormError } from "../use-form-error";
import { forgotSchema, type ForgotValues } from "../schemas";
import { FormAlert } from "./form-alert";
import { PhoneInput } from "./phone-input";

/**
 * Step 1 of password reset. When SMS is in production Sandbox, codes cannot be delivered, so
 * we say so plainly and point to support (an admin can reset the password) instead of
 * pretending a code was sent.
 */
function ForgotForm({ supportPhone }: { supportPhone: string | null }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useFormError();
  const [blocked, setBlocked] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { phone: "" },
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await requestPasswordResetAction(values);
        if (result.ok) {
          router.push(`/verify?${new URLSearchParams({ phone: result.phone, mode: "recovery" })}`);
          return;
        }
        if (result.error === "sandboxBlocked") {
          setBlocked(true);
          return;
        }
        setError(t(`errors.${result.error}`));
      } catch {
        setError(t("errors.network"));
      }
    }),
  );

  if (blocked) {
    return (
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <Badge variant="offer" size="sm">
            {t("sandbox")}
          </Badge>
          <h2 className="font-heading text-lg font-semibold text-ink">{t("forgotSandboxTitle")}</h2>
        </div>
        <p className="text-base text-muted">{t("forgotSandboxBody")}</p>
        {supportPhone ? (
          <Button asChild variant="secondary" block>
            <a
              href={`https://wa.me/${supportPhone.replace(/^\+/, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              <LifeBuoy aria-hidden />
              {t("contactSupport")}
            </a>
          </Button>
        ) : null}
        <Button asChild variant="ghost" block>
          <Link href="/login">{t("backToSignIn")}</Link>
        </Button>
      </section>
    );
  }

  return (
    <Form {...form}>
      {/* POST: a tap before the page has hydrated must not put
          the number in the URL. */}
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
        {error ? <FormAlert key={error.attempt}>{error.value}</FormAlert> : null}
        <Button type="submit" size="lg" block loading={pending}>
          {t("sendCode")}
        </Button>
        <Button asChild variant="ghost" block>
          <Link href="/login">{t("backToSignIn")}</Link>
        </Button>
      </form>
    </Form>
  );
}

export { ForgotForm };
