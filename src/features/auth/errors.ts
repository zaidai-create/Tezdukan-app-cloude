/** Auth error keys shown to people (messages: auth.errors.*). */
export type AuthErrorKey =
  | "invalidCredentials"
  | "phoneTaken"
  | "invalidCode"
  | "tooManyRequests"
  | "phoneNotConfirmed"
  | "weakPassword"
  | "smsFailed"
  | "generic";

/**
 * Maps Supabase Auth error codes to our messages. Unknown errors become "generic" — we never
 * show raw provider text to shopkeepers.
 */
export function authErrorKey(
  error: { code?: string; status?: number } | null | undefined,
): AuthErrorKey {
  switch (error?.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "user_already_exists":
    case "phone_exists":
      return "phoneTaken";
    case "otp_expired":
    case "otp_disabled":
      return "invalidCode";
    case "over_sms_send_rate_limit":
    case "over_request_rate_limit":
      return "tooManyRequests";
    case "phone_not_confirmed":
      return "phoneNotConfirmed";
    case "weak_password":
      return "weakPassword";
    case "sms_send_failed":
    case "hook_timeout":
    case "hook_payload_invalid_content_type":
      return "smsFailed";
    default:
      return error?.status === 429 ? "tooManyRequests" : "generic";
  }
}
