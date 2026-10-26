"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { useRouter } from "@/i18n/navigation";
import { updatePasswordAction } from "../session-actions";
import { newPasswordSchema, type NewPasswordValues } from "../schemas";
import { FormAlert } from "./form-alert";
import { PasswordInput } from "./password-input";

function NewPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "" },
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await updatePasswordAction(values);
        if (result.ok) {
          toast.success(t("passwordUpdated"));
          router.replace(result.redirectTo);
          router.refresh();
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
        {error ? <FormAlert>{error}</FormAlert> : null}
        <Button type="submit" size="lg" block loading={pending}>
          {t("updatePassword")}
        </Button>
      </form>
    </Form>
  );
}

export { NewPasswordForm };
