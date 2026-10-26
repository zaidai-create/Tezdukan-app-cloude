/**
 * `pnpm seed` loads the TezDukan seed (scripts/seed-data.ts, PLAN.md §6.5).
 *
 * - Demo users through the Auth admin API (phone confirmed, password TezDukan-Demo-1).
 * - Rows through the Data API with the secret key (RLS does not apply to the service role).
 * - Every inserted row is recorded in public.seed_registry, so `pnpm seed:reset` removes exactly
 *   those rows and nothing else.
 * Idempotent: rows use ON CONFLICT (id) DO NOTHING (edits made in the app survive a re-run) and
 * existing demo users get their password and phone confirmation reset.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY.
 *      SEED_DEMO_USERS=true|false. Defaults to true for the local stack and false anywhere else,
 *      because demo users have a published password.
 */
import { createSeedClient, isLocalUrl, supabaseUrl, type SeedClient } from "./seed-client";
import * as data from "./seed-data";
import type { Database } from "../src/lib/supabase/database.types";

type TableName = keyof Database["public"]["Tables"];

const CHUNK_SIZE = 500;

async function register(db: SeedClient, tableName: string, ids: string[]): Promise<void> {
  for (let start = 0; start < ids.length; start += CHUNK_SIZE) {
    const rows = ids
      .slice(start, start + CHUNK_SIZE)
      .map((id) => ({ table_name: tableName, row_id: id }));
    const { error } = await db
      .from("seed_registry")
      .upsert(rows, { onConflict: "table_name,row_id", ignoreDuplicates: true });
    if (error) throw new Error(`Registering ${tableName} rows failed: ${error.message}`);
  }
}

async function seedTable<T extends TableName>(
  db: SeedClient,
  table: T,
  rows: data.SeedRow<T>[],
): Promise<void> {
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    const chunk = rows.slice(start, start + CHUNK_SIZE);
    // A generic table name defeats supabase-js overload resolution; the rows are already checked
    // against the table's Insert type through SeedRow<T>.
    const { error } = await db
      .from(table)
      .upsert(chunk as never, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`Seeding ${table} failed: ${error.message}`);
  }
  await register(
    db,
    `public.${table}`,
    rows.map((row) => row.id),
  );
  console.log(`  ${table.padEnd(22)} ${rows.length}`);
}

async function ensureDemoUser(db: SeedClient, user: data.DemoUser): Promise<void> {
  const attributes = {
    phone: user.phone,
    password: data.DEMO_PASSWORD,
    phone_confirm: true,
    user_metadata: { full_name: user.fullName, locale: user.locale },
  };
  const existing = await db.auth.admin.getUserById(user.id);
  if (existing.error && existing.error.status !== 404) {
    throw new Error(`Looking up demo user ${user.phone} failed: ${existing.error.message}`);
  }
  if (existing.data.user) {
    if (existing.data.user.phone !== user.phone.replace(/^\+/, "")) {
      throw new Error(
        `Demo user ${user.id} exists with another phone (${existing.data.user.phone ?? "none"}).`,
      );
    }
    const { error } = await db.auth.admin.updateUserById(user.id, attributes);
    if (error) throw new Error(`Updating demo user ${user.phone} failed: ${error.message}`);
    return;
  }
  const { error } = await db.auth.admin.createUser({ id: user.id, ...attributes });
  if (error) {
    throw new Error(
      `Creating demo user ${user.phone} failed: ${error.message}. If another account already uses this phone, delete it first.`,
    );
  }
}

/**
 * Profiles come from the new-user trigger, so they are not in seed_registry; they go when the
 * demo users are removed. The secret key may write active_* directly; the app may not.
 */
async function setStartingContexts(db: SeedClient): Promise<void> {
  for (const context of data.demoStartingContexts) {
    const { error } = await db
      .from("profiles")
      .update({
        active_role: context.role,
        active_shop_id: context.shopId,
        active_org_id: context.orgId,
      })
      .eq("id", context.userId);
    if (error) throw new Error(`profiles (starting context): ${error.message}`);
  }
  console.log(`  ${"starting contexts".padEnd(22)} ${data.demoStartingContexts.length}`);
}

async function main(): Promise<void> {
  const url = supabaseUrl();
  const flag = process.env.SEED_DEMO_USERS;
  const withDemoUsers = flag === undefined || flag === "" ? isLocalUrl(url) : flag === "true";
  const db = createSeedClient();

  console.log(`Seeding ${url}${withDemoUsers ? " (with demo users)" : " (no demo users)"}`);

  const demoUsers = Object.values(data.DEMO_USERS);
  if (withDemoUsers) {
    for (const user of demoUsers) {
      await ensureDemoUser(db, user);
    }
    await register(
      db,
      "auth.users",
      demoUsers.map((user) => user.id),
    );
    console.log(`  ${"auth.users".padEnd(22)} ${demoUsers.length}`);
  }

  // Parents before children: seed_reset() deletes in reverse registration order.
  await seedTable(db, "service_areas", data.serviceAreas);
  await seedTable(db, "feature_flags", data.featureFlags);
  await seedTable(db, "brands", data.brands);
  await seedTable(db, "categories", data.categories);
  await seedTable(db, "master_products", data.masterProducts);
  await seedTable(db, "product_aliases", data.productAliases);
  await seedTable(db, "organizations", data.organizations);
  await seedTable(db, "warehouses", data.warehouses);
  await seedTable(db, "vehicles", data.vehicles);
  await seedTable(db, "distributor_products", data.distributorProducts);
  await seedTable(db, "pack_units", data.packUnits);
  await seedTable(db, "schemes", data.schemes);
  await seedTable(db, "scheme_products", data.schemeProducts);
  await seedTable(db, "shops", data.buildShops(withDemoUsers));
  await seedTable(db, "storefront_settings", data.storefrontSettings);
  await seedTable(db, "shop_inventory", data.shopInventory);
  await seedTable(db, "shop_stock_movements", data.shopStockMovements);
  if (withDemoUsers) {
    await seedTable(db, "user_roles", data.userRoles);
    await seedTable(db, "org_members", data.orgMembers);
    await seedTable(db, "riders", data.riders);
    await seedTable(db, "shop_staff", data.shopStaff);
    await seedTable(db, "beats", data.beats);
    await seedTable(db, "beat_shops", data.beatShops);
    await seedTable(db, "addresses", data.addresses);
  }
  await seedTable(db, "retailer_accounts", data.buildRetailerAccounts(withDemoUsers));
  if (withDemoUsers) await setStartingContexts(db);

  if (withDemoUsers) {
    console.log(`\nDemo logins (password ${data.DEMO_PASSWORD}):`);
    for (const user of demoUsers) {
      console.log(`  ${user.phone}  ${user.fullName.padEnd(16)} ${user.holds}`);
    }
  }
  console.log("\nDone.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
