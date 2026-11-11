import { z } from "zod";

/**
 * Public env (inlined into the browser bundle, so each var is referenced literally).
 * Validated once at import so a missing value fails loudly instead of as a 401 later.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  NEXT_PUBLIC_SUPPORT_WHATSAPP: z
    .string()
    .regex(/^\+92\d{10}$/)
    .optional(),
  /** Web Push application server key. Without it phone notifications run in Sandbox. */
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(80).optional(),
  /** "on" once the Google provider is configured in Supabase Auth; Sandbox notice otherwise. */
  NEXT_PUBLIC_GOOGLE_SIGN_IN: z.enum(["on", "off"]).default("off"),
  /**
   * Map tiles for the address picker ({z}/{x}/{y} URL). OpenStreetMap's own tiles are free
   * for light use; a busier app should point this at a tile provider with a plan.
   */
  NEXT_PUBLIC_MAP_TILE_URL: z
    .string()
    .regex(/^https:\/\/.+\{z\}.+\{x\}.+\{y\}/)
    .default("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
  NEXT_PUBLIC_MAP_ATTRIBUTION: z.string().min(3).default("© OpenStreetMap contributors"),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || undefined,
  NEXT_PUBLIC_SUPPORT_WHATSAPP: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || undefined,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
  NEXT_PUBLIC_GOOGLE_SIGN_IN: process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN || undefined,
  NEXT_PUBLIC_MAP_TILE_URL: process.env.NEXT_PUBLIC_MAP_TILE_URL || undefined,
  NEXT_PUBLIC_MAP_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || undefined,
});
