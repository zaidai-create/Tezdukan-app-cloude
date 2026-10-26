/**
 * `pnpm seed:reset` removes every row the seed created (public.seed_registry), newest first,
 * including demo auth users, and nothing else. It refuses (and changes nothing) when real data
 * still references a seeded row, e.g. a real order for a seeded product.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY.
 */
import { createSeedClient, supabaseUrl } from "./seed-client";

async function main(): Promise<void> {
  const db = createSeedClient();
  console.log(`Removing seed data from ${supabaseUrl()}`);
  const { data, error } = await db.rpc("seed_reset");
  if (error) {
    throw new Error(
      `seed_reset failed: ${error.message}${error.details ? ` (${error.details})` : ""}`,
    );
  }
  const deleted =
    data && typeof data === "object" && !Array.isArray(data) ? Object.entries(data) : [];
  if (deleted.length === 0) {
    console.log("  nothing to remove");
  }
  for (const [table, count] of deleted) {
    console.log(`  ${table.padEnd(29)} ${String(count)}`);
  }
  console.log("Done.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
