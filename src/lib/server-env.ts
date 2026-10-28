import "server-only";
import { z } from "zod";

/** Server-only secrets and integration settings. Never import from client code. */
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SMS_PROVIDER: z.enum(["sandbox", "twilio", "veevotech", "eocean"]).default("sandbox"),
  SMS_SANDBOX_REVEAL_OTP: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  VAPID_PRIVATE_KEY: z.string().min(40).optional(),
  VAPID_SUBJECT: z
    .string()
    .regex(/^(mailto:|https:\/\/)/)
    .default("mailto:support@tezdukan.pk"),
  /** Bearer token for scheduled HTTP jobs (e.g. flushing the push outbox). */
  CRON_SECRET: z.string().min(16).optional(),
});

export const serverEnv = serverSchema.parse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
  SMS_PROVIDER: process.env.SMS_PROVIDER || undefined,
  SMS_SANDBOX_REVEAL_OTP: process.env.SMS_SANDBOX_REVEAL_OTP || undefined,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || undefined,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || undefined,
  CRON_SECRET: process.env.CRON_SECRET || undefined,
});
