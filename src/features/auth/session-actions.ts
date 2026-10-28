"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { isLocale } from "@/i18n/locales";
import { LOCALE_COOKIE } from "@/i18n/routing";
import { normalizePkMobile } from "@/lib/phone";
import { safeNextPath } from "@/lib/auth/safe-next";
import { getSupabaseAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { authErrorKey, type AuthErrorKey } from "./errors";
import { completeSignIn } from "./complete-sign-in";
import { isSandboxSms, sandboxRevealAllowed } from "./sms-sandbox";
import {
  forgotSchema,
  loginSchema,
  newPasswordSchema,
  otpModeSchema,
  signupSchema,
  verifySchema,
  type ForgotValues,
  type LoginValues,
  type NewPasswordValues,
  type OtpMode,
  type SignupValues,
} from "./schemas";

export type AuthResult<T = object> = ({ ok: true } & T) | { ok: false; error: AuthErrorKey };

const OTP_WINDOW_MS = 10 * 60 * 1000;

export async function signInAction(
  values: LoginValues,
  next?: string,
): Promise<
  AuthResult<{ redirectTo: string }> | { ok: false; error: "phoneNotConfirmed"; phone: string }
> {
  const parsed = loginSchema.safeParse(values);
  const phone = parsed.success ? normalizePkMobile(parsed.data.phone) : null;
  if (!parsed.success || !phone) return { ok: false, error: "invalidCredentials" };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    phone,
    password: parsed.data.password,
  });
  if (error) {
    const key = authErrorKey(error);
    if (key === "phoneNotConfirmed") {
      await supabase.auth.resend({ type: "sms", phone });
      return { ok: false, error: "phoneNotConfirmed", phone };
    }
    return { ok: false, error: key };
  }
  return { ok: true, redirectTo: await completeSignIn(next) };
}

export async function signUpAction(values: SignupValues): Promise<AuthResult<{ phone: string }>> {
  const parsed = signupSchema.safeParse(values);
  const phone = parsed.success ? normalizePkMobile(parsed.data.phone) : null;
  if (!parsed.success || !phone) return { ok: false, error: "generic" };

  const cookieStore = await cookies();
  const locale = cookieStore.get(LOCALE_COOKIE)?.value;
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    phone,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, locale: locale && isLocale(locale) ? locale : "en" },
    },
  });
  if (error) return { ok: false, error: authErrorKey(error) };
  // An existing, confirmed number comes back without a new identity: send them to sign in.
  if (data.user && data.user.identities?.length === 0) return { ok: false, error: "phoneTaken" };
  return { ok: true, phone };
}

export async function verifyOtpAction(input: {
  phone: string;
  token: string;
  mode: OtpMode;
}): Promise<AuthResult<{ redirectTo: string }>> {
  const parsed = verifySchema.safeParse(input);
  const phone = parsed.success ? normalizePkMobile(parsed.data.phone) : null;
  if (!parsed.success || !phone) return { ok: false, error: "invalidCode" };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token: parsed.data.token, type: "sms" });
  if (error)
    return {
      ok: false,
      error: authErrorKey(error) === "generic" ? "invalidCode" : authErrorKey(error),
    };
  if (parsed.data.mode === "recovery") {
    await completeSignIn();
    return { ok: true, redirectTo: "/forgot-password/new" };
  }
  return { ok: true, redirectTo: await completeSignIn() };
}

export async function resendOtpAction(phoneInput: string, mode: OtpMode): Promise<AuthResult> {
  const phone = normalizePkMobile(phoneInput);
  if (!phone || !otpModeSchema.safeParse(mode).success) return { ok: false, error: "generic" };
  const supabase = await getSupabaseServerClient();
  const { error } =
    mode === "signup"
      ? await supabase.auth.resend({ type: "sms", phone })
      : await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
  return error ? { ok: false, error: authErrorKey(error) } : { ok: true };
}

/** Whether codes can be revealed on screen for this mode (Sandbox SMS only). */
export async function requestPasswordResetAction(
  values: ForgotValues,
): Promise<AuthResult<{ phone: string }> | { ok: false; error: "sandboxBlocked" }> {
  const parsed = forgotSchema.safeParse(values);
  const phone = parsed.success ? normalizePkMobile(parsed.data.phone) : null;
  if (!phone) return { ok: false, error: "generic" };
  if (isSandboxSms() && !sandboxRevealAllowed("recovery")) {
    return { ok: false, error: "sandboxBlocked" };
  }
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: false },
  });
  // Do not reveal whether the number has an account: unknown numbers look the same.
  if (error && authErrorKey(error) === "tooManyRequests")
    return { ok: false, error: "tooManyRequests" };
  return { ok: true, phone };
}

export async function updatePasswordAction(
  values: NewPasswordValues,
): Promise<AuthResult<{ redirectTo: string }>> {
  const parsed = newPasswordSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "weakPassword" };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: authErrorKey(error) };
  return { ok: true, redirectTo: await completeSignIn() };
}

const outboxRowSchema = z.object({ payload: z.object({ otp: z.string() }) });

/**
 * Sandbox SMS: the latest OTP sent to this number in the last 10 minutes, read from the
 * outbox. Only when SMS is in Sandbox and revealing is allowed for this mode.
 */
export async function sandboxOtpAction(
  phoneInput: string,
  mode: OtpMode,
): Promise<{ sandbox: boolean; code: string | null }> {
  const sandbox = isSandboxSms();
  const phone = normalizePkMobile(phoneInput);
  if (!sandbox || !phone || !sandboxRevealAllowed(mode) || !hasAdminClient()) {
    return { sandbox, code: null };
  }
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("message_outbox")
    .select("payload")
    .eq("channel", "sms")
    .eq("kind", "otp")
    .eq("to_phone", phone)
    .gte("created_at", new Date(Date.now() - OTP_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = outboxRowSchema.safeParse(data);
  return { sandbox, code: row.success ? row.data.payload.otp : null };
}

/**
 * Starts "Continue with Google": Supabase returns Google's consent URL (with a PKCE verifier
 * stored in a cookie); the browser goes there and comes back to /api/auth/callback.
 */
export async function googleSignInAction(next?: string): Promise<AuthResult<{ url: string }>> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  if (!host) return { ok: false, error: "generic" };
  const callback = new URL(`${proto}://${host}/api/auth/callback`);
  callback.searchParams.set("next", safeNextPath(next, "/"));
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  });
  if (error || !data.url) return { ok: false, error: error ? authErrorKey(error) : "generic" };
  return { ok: true, url: data.url };
}
