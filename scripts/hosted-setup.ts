/**
 * `pnpm hosted:setup` prepares a hosted Supabase project for TezDukan in one go, over the
 * Management API (HTTPS only, so it works where direct Postgres connections are blocked):
 *
 * 1. Applies every migration in supabase/migrations that the project has not run yet, each
 *    in one transaction, and records it in supabase_migrations.schema_migrations under the
 *    file's own version, so `supabase db push` and `supabase migration list` agree later.
 * 2. Configures Auth like supabase/config.toml: phone sign-in with password, OTP through the
 *    private.hook_send_sms hook (the message outbox), site URL and redirect URLs, and
 *    Google when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
 * 3. Removes edge functions the app no longer uses (the old voice-parse).
 * 4. Writes the project's URL and keys to .env.hosted.local (git-ignored) for Vercel and the
 *    seed.
 * 5. With --seed, loads the demo data (scripts/seed.ts) into the project, demo logins included.
 *
 * Env: SUPABASE_ACCESS_TOKEN (a personal access token from supabase.com/dashboard/account/tokens),
 *      SUPABASE_PROJECT_REF (default: the TezDukan project), SITE_URL (the deployed app,
 *      default https://tezdukan.vercel.app), GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (optional),
 *      CRON_SECRET (optional: lets another scheduler call /api/push/flush).
 * Safe to re-run: applied migrations are skipped and the Auth settings are simply set again.
 */
import { spawn } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const API = "https://api.supabase.com/v1";
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const RETIRED_FUNCTIONS = ["voice-parse"];

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF ?? "vgdwsisihixwsuuikhvp";
// The hosted project serves the deployed app. Defaulting to localhost here once sent every
// Google sign-in back to "localhost refused to connect" on phones, so the default is the live
// address and localhost stays only in the redirect allow-list for local development.
const siteUrl = (process.env.SITE_URL ?? "https://tezdukan.vercel.app").replace(/\/$/, "");
const withSeed = process.argv.includes("--seed");

if (!token) {
  console.error(
    "Set SUPABASE_ACCESS_TOKEN first (supabase.com/dashboard/account/tokens → Generate new token).",
  );
  process.exit(1);
}

async function api(method: string, route: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${API}/projects/${ref}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`${method} ${route} → ${response.status}: ${text.slice(0, 2000)}`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return text ? JSON.parse(text) : null;
}

const sql = (query: string) => api("POST", "/database/query", { query });
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

const projectSchema = z.object({ name: z.string(), region: z.string(), status: z.string() });
const versionsSchema = z.array(z.object({ version: z.string() }));
const keysSchema = z.array(
  z.object({ name: z.string(), type: z.string().nullish(), api_key: z.string().nullish() }),
);

async function applyMigrations(): Promise<number> {
  await sql(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );`);
  const applied = new Set(
    versionsSchema
      .parse(await sql("select version from supabase_migrations.schema_migrations"))
      .map((row) => row.version),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  let count = 0;
  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (!version || applied.has(version)) continue;
    const name = rest.join("_");
    const body = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`  ${file} … `);
    // One request = one implicit transaction: the migration and its history row land together.
    await sql(
      `${body}\n;\ninsert into supabase_migrations.schema_migrations (version, name) values (${literal(version)}, ${literal(name)});`,
    );
    console.log("done");
    count += 1;
  }
  return count;
}

async function configureAuth(): Promise<void> {
  const redirects = [siteUrl, `${siteUrl}/**`, "http://localhost:3000", "http://localhost:3000/**"];
  const googleId = process.env.GOOGLE_CLIENT_ID;
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
  await api("PATCH", "/config/auth", {
    site_url: siteUrl,
    uri_allow_list: [...new Set(redirects)].join(","),
    password_min_length: 8,
    mailer_autoconfirm: true,
    external_phone_enabled: true,
    sms_autoconfirm: false,
    sms_otp_length: 6,
    sms_max_frequency: 30,
    sms_template: "TezDukan code: {{ .Code }}. Do not share this code with anyone.",
    // Auth insists on a provider for phone sign-in; the send-SMS hook replaces it, so these
    // placeholders never send anything (same as supabase/config.toml).
    sms_provider: "twilio",
    sms_twilio_account_sid: "AC_placeholder_not_used_send_sms_hook_delivers",
    sms_twilio_message_service_sid: "MG_placeholder_not_used_send_sms_hook_delivers",
    sms_twilio_auth_token: "placeholder_not_used_send_sms_hook_delivers",
    hook_send_sms_enabled: true,
    hook_send_sms_uri: "pg-functions://postgres/private/hook_send_sms",
    ...(googleId && googleSecret
      ? {
          external_google_enabled: true,
          external_google_client_id: googleId,
          external_google_secret: googleSecret,
        }
      : {}),
  });
}

/**
 * Push leaves the moment it is queued: the database calls the app's /api/push/flush (pg_net)
 * with a token it made for itself (migration 20261112140000), and a pg_cron job every minute
 * sends anything still waiting. Here we only tell the database where the app lives; no secret
 * is copied. CRON_SECRET still works for any other scheduler.
 */
async function configureCron(): Promise<boolean> {
  const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
  await sql(
    `update private.push_flush set url = ${literal(`${siteUrl}/api/push/flush`)}, last_kick_at = '-infinity'`,
  );
  return true;
}

async function retireFunctions(): Promise<string[]> {
  const removed: string[] = [];
  for (const slug of RETIRED_FUNCTIONS) {
    try {
      await api("DELETE", `/functions/${slug}`);
      removed.push(slug);
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
    }
  }
  return removed;
}

async function writeEnv(): Promise<Record<string, string>> {
  const keys = keysSchema.parse(await api("GET", "/api-keys?reveal=true"));
  const publishable =
    keys.find((k) => k.type === "publishable")?.api_key ??
    keys.find((k) => k.name === "anon")?.api_key;
  const secret =
    keys.find((k) => k.type === "secret")?.api_key ??
    keys.find((k) => k.name === "service_role")?.api_key;
  if (!publishable || !secret) throw new Error("The project has no publishable or secret API key.");
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable,
    SUPABASE_SECRET_KEY: secret,
  };
  await writeFile(
    ".env.hosted.local",
    `# Hosted Supabase (${ref}). Written by pnpm hosted:setup. Never commit.\n${Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n")}\n`,
  );
  return env;
}

function seed(env: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "tsx", "scripts/seed.ts"], {
      stdio: "inherit",
      env: { ...process.env, ...env, SEED_DEMO_USERS: "true" },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`seed exited ${code}`))));
  });
}

async function main() {
  const project = projectSchema.parse(
    await fetch(`${API}/projects/${ref}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (r) => {
      if (!r.ok) throw new Error(`Project ${ref}: ${r.status} ${await r.text()}`);
      return r.json();
    }),
  );
  console.log(`Project: ${project.name} (${ref}, ${project.region}, ${project.status})`);

  console.log("Migrations:");
  const applied = await applyMigrations();
  console.log(applied ? `  ${applied} applied.` : "  already up to date.");

  await configureAuth();
  console.log(`Auth: phone + password, SMS codes via the outbox, site ${siteUrl}.`);

  console.log(
    (await configureCron())
      ? "Cron: push notifications flushed every minute (also keeps the server warm)."
      : "Cron: skipped.",
  );

  const removed = await retireFunctions();
  if (removed.length) console.log(`Removed edge functions: ${removed.join(", ")}.`);

  const env = await writeEnv();
  console.log("Keys written to .env.hosted.local.");

  if (withSeed) {
    console.log("Seeding demo data…");
    await seed(env);
  }
  console.log("Hosted Supabase is ready.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
