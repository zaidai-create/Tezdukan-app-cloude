import "server-only";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { OtpMode } from "./schemas";

/** True while SMS runs in Sandbox (no provider keys): codes go to the outbox, not a phone. */
export function isSandboxSms(): boolean {
  return serverEnv.SMS_PROVIDER === "sandbox";
}

/**
 * Whether the Sandbox panel may show a code on screen. Password-reset codes are never shown in
 * production: that would let anyone take over an account. In production Sandbox, an admin
 * resets the password instead.
 */
export function sandboxRevealAllowed(mode: OtpMode): boolean {
  if (!isSandboxSms() || !serverEnv.SMS_SANDBOX_REVEAL_OTP) return false;
  return mode === "signup" || publicEnv.NEXT_PUBLIC_APP_ENV !== "production";
}
