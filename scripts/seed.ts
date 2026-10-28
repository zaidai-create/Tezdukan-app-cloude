/**
 * `pnpm seed` loads the TezDukan seed (scripts/seed-data.ts, PLAN.md §6.5).
 *
 * - Demo users through the Auth admin API (phone confirmed, password TezDukan-Demo-1).
 * - Rows through the Data API with the secret key (RLS does not apply to the service role).
 * - Every inserted row is recorded in public.seed_registry, so `pnpm seed:reset` removes exactly
 *   those rows and nothing else.
 * - Photos from scripts/seed-images uploaded to the product-images bucket (seed/...). Storage
 *   objects are not in seed_registry; `pnpm seed:reset` leaves them.
 * Idempotent: rows use ON CONFLICT (id) DO NOTHING (edits made in the app survive a re-run) and
 * existing demo users get their password and phone confirmation reset. Photo paths and the
 * key-account tier are back-filled only where still empty.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY.
 *      SEED_DEMO_USERS=true|false. Defaults to true for the local stack and false anywhere else,
 *      because demo users have a published password.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { createSeedClient, isLocalUrl, supabaseUrl, type SeedClient } from "./seed-client";
import * as data from "./seed-data";
import * as ordering from "./seed-ordering";
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

async function uploadSeedImages(db: SeedClient): Promise<void> {
  const root = path.join(import.meta.dirname, "seed-images");
  let count = 0;
  for (const folder of await readdir(root)) {
    for (const file of await readdir(path.join(root, folder))) {
      if (!file.endsWith(".webp")) continue;
      const body = await readFile(path.join(root, folder, file));
      const { error } = await db.storage
        .from("product-images")
        .upload(`${data.SEED_IMAGE_DIR}/${folder}/${file}`, body, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: true,
        });
      if (error) throw new Error(`Uploading ${folder}/${file} failed: ${error.message}`);
      count += 1;
    }
  }
  console.log(`  ${"seed images".padEnd(22)} ${count}`);
}

/** Rows seeded before photos existed: fill in photo paths and the key-account tier if empty. */
async function backfill(db: SeedClient): Promise<void> {
  for (const row of data.masterProducts.filter((p) => p.image_path)) {
    const { error } = await db
      .from("master_products")
      .update({ image_path: row.image_path })
      .eq("id", row.id)
      .is("image_path", null);
    if (error) throw new Error(`master_products (photos): ${error.message}`);
  }
  for (const row of data.categories.filter((c) => c.image_path)) {
    const { error } = await db
      .from("categories")
      .update({ image_path: row.image_path })
      .eq("id", row.id)
      .is("image_path", null);
    if (error) throw new Error(`categories (photos): ${error.message}`);
  }
  const { error } = await db
    .from("retailer_accounts")
    .update({ price_tier_id: data.KEY_ACCOUNT_TIER_ID })
    .eq("id", data.seedId("retailer-account:indus-traders:tezdukan"))
    .is("price_tier_id", null);
  if (error) throw new Error(`retailer_accounts (tier): ${error.message}`);
}

/** Seeded orders use TD-000101..; new orders continue after them. */
async function bumpOrderCounter(db: SeedClient): Promise<void> {
  const { data: row, error } = await db
    .from("counters")
    .select("id, value")
    .eq("scope", "order_number")
    .maybeSingle();
  if (error) throw new Error(`counters: ${error.message}`);
  if (!row) {
    const insert = await db
      .from("counters")
      .insert({ scope: "order_number", value: ordering.LAST_SEED_ORDER_NUMBER });
    if (insert.error) throw new Error(`counters: ${insert.error.message}`);
  } else if (row.value < ordering.LAST_SEED_ORDER_NUMBER) {
    const update = await db
      .from("counters")
      .update({ value: ordering.LAST_SEED_ORDER_NUMBER })
      .eq("id", row.id);
    if (update.error) throw new Error(`counters: ${update.error.message}`);
  }
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
  await seedTable(db, "price_tiers", ordering.priceTiers);
  await seedTable(db, "price_tier_items", ordering.priceTierItems);
  await seedTable(db, "organizations", ordering.mehranOrganizations);
  await seedTable(db, "warehouses", ordering.mehranWarehouses);
  await seedTable(db, "distributor_products", ordering.mehranProducts);
  await seedTable(db, "pack_units", ordering.mehranPackUnits);
  await seedTable(db, "schemes", ordering.mehranSchemes);
  await seedTable(db, "scheme_products", ordering.mehranSchemeProducts);
  await seedTable(db, "stock_batches", ordering.stockBatches);
  await seedTable(db, "stock_movements", ordering.stockMovements);
  await seedTable(db, "banners", ordering.banners);
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
  await seedTable(db, "retailer_accounts", ordering.mehranRetailerAccounts);
  if (withDemoUsers) {
    const history = ordering.buildOrderHistory();
    await seedTable(db, "ledger_accounts", history.ledgerAccounts);
    await seedTable(db, "orders", history.orders);
    await seedTable(db, "order_items", history.orderItems);
    await seedTable(db, "order_status_history", history.statusHistory);
    await seedTable(db, "delivery_otps", history.deliveryOtps);
    await seedTable(db, "ledger_journals", history.ledgerJournals);
    await seedTable(db, "ledger_entries", history.ledgerEntries);
    await seedTable(db, "payments", history.payments);
    await seedTable(db, "payment_allocations", history.paymentAllocations);
    await seedTable(db, "credit_notes", history.creditNotes);
    await seedTable(db, "reviews", history.reviews);
    await bumpOrderCounter(db);
  }
  await uploadSeedImages(db);
  await backfill(db);
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
