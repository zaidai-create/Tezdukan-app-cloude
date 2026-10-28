import { createClient } from "@supabase/supabase-js";

/** Secret-key client for test setup and clean-up against the local stack. */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Removes a user created by a test (auth.users stores the phone without the plus). */
export async function deleteUserByPhone(e164: string) {
  const admin = adminClient();
  const phone = e164.replace(/^\+/, "");
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.phone === phone);
    if (user) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;
      return;
    }
    if (data.users.length < 200) return;
  }
}

/** A verified account for a test, created without sending an SMS (no rate limit). */
export async function createConfirmedUser(e164: string, password: string, fullName: string) {
  const { error } = await adminClient().auth.admin.createUser({
    phone: e164.replace(/^\+/, ""),
    password,
    phone_confirm: true,
    user_metadata: { full_name: fullName, locale: "en" },
  });
  if (error) throw error;
}

/**
 * A fresh dukandar with an approved shop in Latifabad Unit 6, acting as that dukan. Ordering
 * journeys use one per run, so parallel viewports never share a cart or an order list.
 */
export async function createDukandar(e164: string, password: string, fullName: string) {
  const admin = adminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    phone: e164.replace(/^\+/, ""),
    password,
    phone_confirm: true,
    user_metadata: { full_name: fullName, locale: "en" },
  });
  if (error) throw error;
  const userId = created.user.id;
  const area = await admin
    .from("service_areas")
    .select("id")
    .eq("slug", "latifabad-unit-6")
    .single();
  if (area.error) throw area.error;
  const shop = await admin
    .from("shops")
    .insert({
      owner_id: userId,
      name: `${fullName} Store`,
      slug: `e2e-${e164.slice(-7)}-${Date.now().toString(36)}`,
      phone: e164,
      address_line: "Shop 3, Test Market, Latifabad Unit 6, Hyderabad",
      area_id: area.data.id,
      lat: 25.3735,
      lng: 68.3875,
      status: "approved",
    })
    .select("id")
    .single();
  if (shop.error) throw shop.error;
  const staff = await admin
    .from("shop_staff")
    .insert({ shop_id: shop.data.id, user_id: userId, role: "owner", status: "active" });
  if (staff.error) throw staff.error;
  const profile = await admin
    .from("profiles")
    .update({ active_role: "dukandar", active_shop_id: shop.data.id })
    .eq("id", userId);
  if (profile.error) throw profile.error;
  return { userId, shopId: shop.data.id };
}

/** Empties every cart a user holds (screenshot runs leave no stock in a test dukan's cart). */
export async function clearCarts(userId: string) {
  const { error } = await adminClient().from("carts").delete().eq("user_id", userId);
  if (error) throw error;
}

/**
 * Signs in as a test dukandar and places one order with Indus Traders big enough to need a
 * confirmation (over Rs 25,000 of Tapal Danedar), straight through the RPCs. Returns the order.
 */
export async function placeBigOrder(e164: string, password: string, shopId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishable) throw new Error("E2E needs the Supabase URL and publishable key");
  const client = createClient(url, publishable, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ phone: e164, password });
  if (signIn.error) throw signIn.error;

  const admin = adminClient();
  const org = await admin.from("organizations").select("id").eq("name", "Indus Traders").single();
  if (org.error) throw org.error;
  const product = await admin
    .from("distributor_products")
    .select("id, trade_price_paisa, pack_units(id, base_qty)")
    .eq("org_id", org.data.id)
    .ilike("name", "%Tapal Danedar%")
    .limit(1)
    .single();
  if (product.error) throw product.error;
  const unit = [...product.data.pack_units].sort((a, b) => a.base_qty - b.base_qty)[0];
  if (!unit) throw new Error("Tapal Danedar has no pack units");
  const quantity = Math.ceil(2_500_000 / (product.data.trade_price_paisa * unit.base_qty));

  const cart = await client.rpc("set_cart_item", {
    p_shop_id: shopId,
    p_distributor_product_id: product.data.id,
    p_pack_unit_id: unit.id,
    p_quantity: quantity,
  });
  if (cart.error) throw cart.error;
  const slots = await client.rpc("delivery_slots", {
    p_shop_id: shopId,
    p_org_id: org.data.id,
    p_days: 2,
  });
  if (slots.error) throw slots.error;
  const slot = (slots.data as { slot_start: string; slot_end: string }[])[0];
  if (!slot) throw new Error("Indus Traders has no delivery slot");
  const placed = await client.rpc("place_order", {
    p_shop_id: shopId,
    p_client_request_id: crypto.randomUUID(),
    p_payment_method: "cod",
    p_slots: { [org.data.id]: { start: slot.slot_start, end: slot.slot_end } },
  });
  if (placed.error) throw placed.error;
  const order = (placed.data as { orders: { id: string; order_number: string }[] }).orders[0];
  if (!order) throw new Error("No order was placed");
  return order;
}

/** Removes products a catalog test added (saved without stock, so nothing references them). */
export async function deleteOrgProductsNamed(prefix: string) {
  const { error } = await adminClient()
    .from("distributor_products")
    .delete()
    .like("name", `${prefix}%`);
  if (error) throw error;
}
