import { describe, expect, it } from "vitest";
import { authErrorKey } from "./errors";

describe("authErrorKey", () => {
  it("maps known Supabase codes", () => {
    expect(authErrorKey({ code: "invalid_credentials" })).toBe("invalidCredentials");
    expect(authErrorKey({ code: "phone_exists" })).toBe("phoneTaken");
    expect(authErrorKey({ code: "otp_expired" })).toBe("invalidCode");
    expect(authErrorKey({ code: "over_sms_send_rate_limit" })).toBe("tooManyRequests");
    expect(authErrorKey({ code: "phone_not_confirmed" })).toBe("phoneNotConfirmed");
  });

  it("never leaks unknown errors", () => {
    expect(authErrorKey({ code: "something_new" })).toBe("generic");
    expect(authErrorKey(null)).toBe("generic");
    expect(authErrorKey({ status: 429 })).toBe("tooManyRequests");
  });
});
