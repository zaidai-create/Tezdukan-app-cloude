import { z } from "zod";
import { isPkMobile } from "@/lib/phone";

/**
 * Shared by forms (client) and Server Actions (server). Issue messages are keys in the
 * `validation` message namespace; the UI translates them.
 */
export const phoneField = z
  .string()
  .trim()
  .min(1, "phoneRequired")
  .refine((value) => isPkMobile(value), "phoneInvalid");

const passwordField = z.string().min(8, "passwordShort").max(72, "passwordLong");

export const loginSchema = z.object({
  phone: phoneField,
  password: z.string().min(1, "passwordRequired").max(72, "passwordLong"),
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "nameShort").max(80, "nameLong"),
  phone: phoneField,
  password: passwordField,
});

export const otpModeSchema = z.enum(["signup", "recovery"]);
export type OtpMode = z.infer<typeof otpModeSchema>;

export const verifySchema = z.object({
  phone: phoneField,
  token: z.string().regex(/^\d{6}$/, "codeInvalid"),
  mode: otpModeSchema,
});

export const forgotSchema = z.object({ phone: phoneField });

export const newPasswordSchema = z.object({ password: passwordField });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ForgotValues = z.infer<typeof forgotSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
