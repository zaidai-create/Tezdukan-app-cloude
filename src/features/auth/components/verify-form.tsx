"use client";

import { MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Link, useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { maskPkMobile } from "@/lib/phone";
import { resendOtpAction, sandboxOtpAction, verifyOtpAction } from "../session-actions";
import type { OtpMode } from "../schemas";
import { FormAlert } from "./form-alert";

const RESEND_SECONDS = 30;

/**
 * Six-digit SMS code. Submits by itself when the sixth digit lands. While SMS runs in
 * Sandbox, a clearly labelled panel shows the code that would have been texted.
 */
function VerifyForm({ phone, mode }: { phone: string; mode: OtpMode }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [verifying, startVerify] = useTransition();
  const [resending, startResend] = useTransition();

  const sandboxQuery = useQuery({
    queryKey: ["sandbox-otp", phone, mode],
    queryFn: () => sandboxOtpAction(phone, mode),
    staleTime: 0,
  });
  const sandbox = {
    active: sandboxQuery.data?.sandbox ?? false,
    code: sandboxQuery.data?.code ?? null,
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = (value: string) =>
    startVerify(async () => {
      setError(null);
      try {
        const result = await verifyOtpAction({ phone, token: value, mode });
        if (result.ok) {
          haptic("success");
          router.replace(result.redirectTo);
          router.refresh();
          return;
        }
        haptic("warning");
        setCode("");
        setError(t(`errors.${result.error}`));
      } catch {
        setError(t("errors.network"));
      }
    });

  const resend = () =>
    startResend(async () => {
      setError(null);
      const result = await resendOtpAction(phone, mode);
      if (!result.ok) {
        setError(t(`errors.${result.error}`));
        return;
      }
      setCooldown(RESEND_SECONDS);
      setNotice(t("codeSent"));
      await sandboxQuery.refetch();
    });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-base text-muted">
        {t("verifySubtitle", { phone: maskPkMobile(phone) })}{" "}
        <Link
          href={mode === "signup" ? "/signup" : "/forgot-password"}
          className="font-semibold text-primary-strong underline-offset-4 hover:underline"
        >
          {t("changeNumber")}
        </Link>
      </p>

      {sandbox.active ? (
        <section
          aria-live="polite"
          className="flex gap-3 rounded-lg border border-dashed border-awning-ink/40 bg-awning-soft p-4"
        >
          <MessageSquareText aria-hidden className="mt-0.5 size-5 shrink-0 text-awning-ink" />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="offer" size="sm">
                {t("sandbox")}
              </Badge>
              <span className="text-sm font-semibold text-ink">{t("sandboxSmsTitle")}</span>
            </div>
            <p className="text-sm text-ink">{t("sandboxSmsBody")}</p>
            {sandbox.code ? (
              <p className="flex items-baseline gap-2 text-base font-semibold text-ink">
                {t("sandboxCodeLabel")}
                <span dir="ltr" className="num font-heading text-2xl tracking-[0.3em]">
                  {sandbox.code}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted">{t("sandboxUnavailable")}</p>
            )}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="otp" className="text-sm font-semibold text-ink">
          {t("codeLabel")}
        </label>
        <InputOTP
          id="otp"
          maxLength={6}
          value={code}
          onChange={(value) => {
            setCode(value.replace(/\D/g, ""));
            setError(null);
          }}
          onComplete={submit}
          disabled={verifying}
          aria-invalid={Boolean(error)}
          pattern="^[0-9]+$"
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, index) => (
              <InputOTPSlot key={index} index={index} aria-invalid={Boolean(error)} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error ? <FormAlert>{error}</FormAlert> : null}
      {notice && !error ? <FormAlert tone="info">{notice}</FormAlert> : null}

      <Button
        size="lg"
        block
        loading={verifying}
        disabled={code.length !== 6}
        onClick={() => submit(code)}
      >
        {verifying ? t("verifying") : t("verify")}
      </Button>
      <Button
        variant="ghost"
        block
        disabled={cooldown > 0 || resending}
        loading={resending}
        onClick={resend}
      >
        {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resend")}
      </Button>
    </div>
  );
}

export { VerifyForm };
