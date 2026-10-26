"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { isLocale } from "@/i18n/locales";
import { LOCALE_COOKIE } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { normalizePkMobile } from "@/lib/phone";
import { CONTEXT_COOKIE, appRoles, roleHome, serializeContext } from "@/lib/auth/roles";
import { safeNextPath } from "@/lib/auth/safe-next";
import { serverEnv } from "@/lib/server-env";
import { getSupabaseAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { authErrorKey, type AuthErrorKey } from "./errors";
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

const ONE_YEAR = 60 * 60 * 24 * 365;
const OTP_WINDOW_MS = 10 * 60 * 1000;

const landingSchema = z.object({
  active_role: z.enum(appRoles),
  active_shop_id: z.uuid().nullable(),
  active_org_id: z.uuid().nullable(),
  locale: z.string().nullable(),
});

/**
 * After any successful sign-in: restore the person's last active role into the context
 * cookie and reconcile the language (a language picked on this device wins and is saved;
 * otherwise the profile's language is applied). Returns where to land.
 */
async function completeSignIn(next?: string): Promise<string> {
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return "/login";

  const { data } = await supabase
    .from("profiles")
    .select("active_role, active_shop_id, active_org_id, locale")
    .eq("id", userId)
    .single();
  const profile = landingSchema.safeParse(data);
  const cookieStore = await cookies();

  const role = profile.success ? profile.data.active_role : "customer";
  const contextId = profile.success
    ? role === "dukandar"
      ? profile.data.active_shop_id
      : ["distributor", "booker", "rider"].includes(role)
        ? profile.data.active_org_id
        : null
    : null;
  cookieStore.set(CONTEXT_COOKIE, serializeContext({ role, contextId }), {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  const deviceLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const profileLocale = profile.success ? profile.data.locale : null;
  if (deviceLocale && isLocale(deviceLocale)) {
    if (deviceLocale !== profileLocale) {
      await supabase.from("profiles").update({ locale: deviceLocale }).eq("id", userId);
    }
  } else if (profileLocale && isLocale(profileLocale)) {
    cookieStore.set(LOCALE_COOKIE, profileLocale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  }

  return safeNextPath(next, roleHome[role]);
}

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
function sandboxRevealAllowed(mode: OtpMode): boolean {
  if (serverEnv.SMS_PROVIDER !== "sandbox" || !serverEnv.SMS_SANDBOX_REVEAL_OTP) return false;
  // Password-reset codes are never shown on screen in production: that would let anyone
  // take over an account. In production Sandbox, an admin resets the password instead.
  return mode === "signup" || publicEnv.NEXT_PUBLIC_APP_ENV !== "production";
}

export async function smsModeAction(): Promise<{ sandbox: boolean; resetBlocked: boolean }> {
  const sandbox = serverEnv.SMS_PROVIDER === "sandbox";
  return { sandbox, resetBlocked: sandbox && !sandboxRevealAllowed("recovery") };
}

export async function requestPasswordResetAction(
  values: ForgotValues,
): Promise<AuthResult<{ phone: string }> | { ok: false; error: "sandboxBlocked" }> {
  const parsed = forgotSchema.safeParse(values);
  const phone = parsed.success ? normalizePkMobile(parsed.data.phone) : null;
  if (!phone) return { ok: false, error: "generic" };
  if (serverEnv.SMS_PROVIDER === "sandbox" && !sandboxRevealAllowed("recovery")) {
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
  const sandbox = serverEnv.SMS_PROVIDER === "sandbox";
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
