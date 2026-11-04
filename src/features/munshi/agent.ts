import "server-only";
import { z } from "zod";
import { getInbox, getDashboard, getInsights } from "@/features/distributor/data";
import { getMyCustomerOrders } from "@/features/customer-orders/data";
import { getShopDashboard } from "@/features/shop-dashboard/data";
import { getSalesReport } from "@/features/shop-report/data";
import { peakIndex, slotLabel } from "@/features/shop-report/figures";
import { reportRanges } from "@/features/shop-report/schemas";
import { getNearbyShops, getStorefrontProducts } from "@/features/storefront/data";
import type { StorefrontProduct } from "@/features/storefront/schemas";
import { geminiGenerate, type FunctionDeclaration, type GeminiContent } from "@/lib/ai/gemini";
import { TEZDUKAN_KNOWLEDGE } from "@/lib/ai/knowledge";
import type { AppRole } from "@/lib/auth/roles";
import type { ShellSession } from "@/lib/auth/session-types";
import { formatRs, rupeesToPaisa } from "@/lib/money";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { plain } from "./text";

/**
 * Tez (named Munshi in the spec and in this code): a tool-using assistant for the signed-in
 * person's active role. Every tool runs with the person's own session, so database permissions
 * (RLS) decide what it can read or change.
 */

export type CartAddition = { product: StorefrontProduct; quantity: number };
type ToolContext = {
  session: ShellSession;
  contextId: string | null;
  /** Products this turn's searches returned, so add_to_cart can only add real, current items. */
  found: Map<string, StorefrontProduct>;
  cart: CartAddition[];
};
type Tool = {
  declaration: FunctionDeclaration;
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
};

export type MunshiLink = { screen: string; href: string };
export type MunshiAnswer = { reply: string; link: MunshiLink | null; cart: CartAddition[] };

const screens: Partial<Record<AppRole, Record<string, string>>> = {
  customer: {
    home: "/",
    categories: "/categories",
    nearby: "/shops",
    cart: "/cart",
    orders: "/orders",
    account: "/account",
  },
  dukandar: {
    home: "/dukan",
    orders: "/dukan/customer-orders",
    reports: "/dukan/reports",
    store: "/dukan/store",
    products: "/dukan/products",
    wholesale: "/dukan/wholesale",
    ledger: "/dukan/ledger",
    stockOrders: "/dukan/orders",
    chat: "/dukan/chat",
    account: "/dukan/account",
  },
  distributor: {
    home: "/distributor",
    orders: "/distributor/orders",
    catalog: "/distributor/catalog",
    chat: "/distributor/chat",
    account: "/distributor/account",
  },
};

const text = (max = 80) => z.string().trim().min(1).max(max);
const rupees = z.number().min(0).max(1_000_000);

const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, " ").trim();

function openScreenTool(role: AppRole): Tool | null {
  const map = screens[role];
  if (!map) return null;
  const names = Object.keys(map);
  return {
    declaration: {
      name: "open_screen",
      description:
        "Show the person a button that opens a screen of the app. Use when they ask to go somewhere or when a screen does what they want.",
      parameters: {
        type: "object",
        properties: { screen: { type: "string", enum: names } },
        required: ["screen"],
      },
    },
    run: async (args) => {
      const screen = z.enum(names as [string, ...string[]]).parse(args.screen);
      return { shown: true, screen };
    },
  };
}

// ---- Dukandar ---------------------------------------------------------------------------------

const dukandarTools: Tool[] = [
  {
    declaration: {
      name: "today_summary",
      description:
        "Today's online sales, orders, new orders waiting, products low on stock and stock value for the dukan.",
    },
    run: async (_args, ctx) => {
      const dash = await getShopDashboard(ctx.contextId ?? "");
      return {
        shop: dash.shop.name,
        online: dash.shop.is_live,
        sales_today: formatRs(dash.today.sales_paisa),
        orders_today: dash.today.orders,
        delivered_today: dash.today.delivered,
        new_orders_waiting: dash.counts.new,
        orders_in_progress: dash.counts.active,
        low_stock: dash.low_stock.map(
          (item) => `${item.name} (${Math.floor(item.qty_on_hand)} left)`,
        ),
        stock_value: formatRs(dash.stock.value_paisa),
        products: dash.stock.products,
      };
    },
  },
  {
    declaration: {
      name: "new_orders",
      description: "Customer orders that are waiting or in progress, newest first.",
    },
    run: async (_args, ctx) => {
      const dash = await getShopDashboard(ctx.contextId ?? "");
      return dash.queue.map((order) => ({
        number: order.order_number,
        customer: order.customer_name,
        status: order.status,
        total: formatRs(order.total_paisa),
        items: order.items_preview,
      }));
    },
  },
  {
    declaration: {
      name: "sales_report",
      description:
        "The dukan's online sales for a period: sales, orders, average bill, profit, customers, the change against the period before, the busiest time and the best sellers.",
      parameters: {
        type: "object",
        properties: { range: { type: "string", enum: [...reportRanges] } },
        required: ["range"],
      },
    },
    run: async (args, ctx) => {
      const range = z.enum(reportRanges).parse(args.range);
      const report = await getSalesReport(ctx.contextId ?? "", range);
      if (!report) return { error: "no_report_access" };
      const { totals, previous } = report;
      const peak = peakIndex(report.series.map((entry) => entry.sales_paisa));
      const busiest = peak >= 0 ? report.series[peak] : undefined;
      return {
        period: report.from === report.to ? report.from : `${report.from} to ${report.to}`,
        sales: formatRs(totals.sales_paisa),
        sales_before: formatRs(previous.sales_paisa),
        orders: totals.orders,
        orders_before: previous.orders,
        delivered: totals.delivered,
        cancelled: totals.cancelled,
        still_on_the_way: totals.in_progress,
        average_bill: formatRs(totals.avg_bill_paisa),
        profit:
          totals.costed_paisa > 0 ? formatRs(totals.profit_paisa) : "unknown (no buying prices)",
        customers: totals.customers,
        busiest:
          busiest && busiest.start_hour !== null
            ? slotLabel(busiest.start_hour)
            : (busiest?.day ?? null),
        best_sellers: report.top_products.map(
          (product) => `${product.name}: ${formatRs(product.sales_paisa)}`,
        ),
      };
    },
  },
  {
    declaration: {
      name: "set_online",
      description:
        "Switch the dukan's online orders on (customers can order) or off. Only when the dukandar asks for it.",
      parameters: {
        type: "object",
        properties: { online: { type: "boolean" } },
        required: ["online"],
      },
    },
    run: async (args, ctx) => {
      const online = z.boolean().parse(args.online);
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase.rpc("update_shop_storefront", {
        p_shop_id: ctx.contextId ?? "",
        p_is_live: online,
      });
      if (error) return { done: false, error: error.message };
      const live = z.object({ is_live: z.boolean() }).safeParse(data);
      return { done: true, online: live.success ? live.data.is_live : online };
    },
  },
  {
    declaration: {
      name: "find_my_products",
      description:
        "Find products in the dukan by name (English, Roman Urdu or Urdu). Returns ids for changes.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Product name or part of it" } },
        required: ["query"],
      },
    },
    run: async (args, ctx) => {
      const query = normalize(text().parse(args.query));
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase
        .from("shop_inventory")
        .select("id, name, pack_size_label, selling_price_paisa, qty_on_hand, is_visible_online")
        .eq("shop_id", ctx.contextId ?? "")
        .eq("is_active", true)
        .ilike("search_text", `%${query.replace(/[%_]/g, "")}%`)
        .order("name")
        .limit(8);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        pack: row.pack_size_label,
        price: formatRs(row.selling_price_paisa),
        stock: Number(row.qty_on_hand),
        shown_online: row.is_visible_online,
      }));
    },
  },
  {
    declaration: {
      name: "update_my_product",
      description:
        "Change one of the dukan's products: its selling price in rupees, the stock on the shelf, or whether customers see it. Only change what the person asked for.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          price_rupees: { type: "number" },
          stock_qty: { type: "number" },
          show_online: { type: "boolean" },
        },
        required: ["product_id"],
      },
    },
    run: async (args, ctx) => {
      const input = z
        .object({
          product_id: z.uuid(),
          price_rupees: rupees.optional(),
          stock_qty: z.number().int().min(0).max(1_000_000).optional(),
          show_online: z.boolean().optional(),
        })
        .parse(args);
      const supabase = await getSupabaseServerClient();
      const patch: { selling_price_paisa?: number; is_visible_online?: boolean } = {};
      if (input.price_rupees !== undefined)
        patch.selling_price_paisa = rupeesToPaisa(input.price_rupees);
      if (input.show_online !== undefined) patch.is_visible_online = input.show_online;
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase
          .from("shop_inventory")
          .update(patch)
          .eq("id", input.product_id)
          .eq("shop_id", ctx.contextId ?? "");
        if (error) throw new Error(error.message);
      }
      if (input.stock_qty !== undefined) {
        const { error } = await supabase.rpc("set_shop_stock", {
          p_inventory_id: input.product_id,
          p_qty: input.stock_qty,
        });
        if (error) throw new Error(error.message);
      }
      const { data } = await supabase
        .from("shop_inventory")
        .select("name, selling_price_paisa, qty_on_hand, is_visible_online")
        .eq("id", input.product_id)
        .maybeSingle();
      return data
        ? {
            done: true,
            name: data.name,
            price: formatRs(data.selling_price_paisa),
            stock: Number(data.qty_on_hand),
            shown_online: data.is_visible_online,
          }
        : { done: false };
    },
  },
  {
    declaration: {
      name: "search_catalog",
      description:
        "Search the TezDukan product catalogue (with photos and MRP) to find a product to add to the dukan.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    run: async (args) => {
      const query = text().parse(args.query);
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase.rpc("search_master_products", {
        p_query: query,
        p_limit: 5,
      });
      if (error) throw new Error(error.message);
      return z
        .array(
          z.object({
            id: z.uuid(),
            name: z.string(),
            pack_size_label: z.string().nullable(),
            mrp_paisa: z.number().int().nullable(),
          }),
        )
        .parse(data)
        .map((item) => ({
          catalog_id: item.id,
          name: item.name,
          pack: item.pack_size_label,
          mrp: item.mrp_paisa ? formatRs(item.mrp_paisa) : null,
        }));
    },
  },
  {
    declaration: {
      name: "add_my_products",
      description:
        "Add products to the dukan. Use catalog_id from search_catalog when the product is in the catalogue, otherwise a name. Price is the selling price in rupees; qty is how many are on the shelf.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                catalog_id: { type: "string" },
                name: { type: "string" },
                price_rupees: { type: "number" },
                qty: { type: "number" },
              },
              required: ["price_rupees"],
            },
          },
        },
        required: ["items"],
      },
    },
    run: async (args, ctx) => {
      const items = z
        .array(
          z.object({
            catalog_id: z.uuid().optional(),
            name: z.string().trim().min(2).max(160).optional(),
            price_rupees: rupees,
            qty: z.number().int().min(0).max(100_000).default(0),
          }),
        )
        .min(1)
        .max(20)
        .parse(args.items);
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase.rpc("add_shop_products", {
        p_shop_id: ctx.contextId ?? "",
        p_items: items.map((item) => ({
          master_product_id: item.catalog_id,
          name: item.catalog_id ? undefined : item.name,
          selling_price_paisa: rupeesToPaisa(item.price_rupees),
          qty: item.qty,
        })),
      });
      if (error) throw new Error(error.message);
      return data;
    },
  },
];

// ---- Customer ---------------------------------------------------------------------------------

const customerTools: Tool[] = [
  {
    declaration: {
      name: "nearby_dukans",
      description:
        "Dukans near the customer that are open for orders, with delivery time and fees.",
    },
    run: async () => {
      const shops = await getNearbyShops();
      return shops.slice(0, 6).map((shop) => ({
        name: shop.name,
        area: shop.area_name,
        open: shop.is_live,
        delivery_minutes: shop.eta_minutes,
        delivery_fee: formatRs(shop.delivery_fee_paisa),
        minimum_order: formatRs(shop.min_order_paisa),
        free_delivery_above: shop.free_delivery_above_paisa
          ? formatRs(shop.free_delivery_above_paisa)
          : null,
      }));
    },
  },
  {
    declaration: {
      name: "search_products",
      description: "Find products the customer can order now from nearby dukans, with prices.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    run: async (args, ctx) => {
      const products = await getStorefrontProducts({ query: text().parse(args.query), limit: 8 });
      for (const product of products) ctx.found.set(product.id, product);
      return products.map((product) => ({
        id: product.id,
        name: product.name,
        pack: product.pack_size_label,
        price: formatRs(product.selling_price_paisa),
        dukan: product.shop_name,
      }));
    },
  },
  {
    declaration: {
      name: "add_to_cart",
      description:
        "Put products in the customer's cart when they ask to order or buy something. Use ids from search_products in this turn; prefer one dukan so there is one delivery.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, quantity: { type: "integer" } },
              required: ["id", "quantity"],
            },
          },
        },
        required: ["items"],
      },
    },
    run: async (args, ctx) => {
      const items = z
        .array(z.object({ id: z.string(), quantity: z.number().int().min(1).max(20) }))
        .min(1)
        .max(10)
        .parse(args.items);
      const added: string[] = [];
      const missing: string[] = [];
      for (const item of items) {
        const product = ctx.found.get(item.id);
        if (!product) {
          missing.push(item.id);
          continue;
        }
        ctx.cart.push({ product, quantity: item.quantity });
        added.push(`${item.quantity} x ${product.name} (${product.shop_name})`);
      }
      return missing.length > 0
        ? { added, not_found: missing, hint: "search_products first" }
        : { added };
    },
  },
  {
    declaration: {
      name: "my_orders",
      description: "The customer's recent orders with their status.",
    },
    run: async (_args, ctx) => {
      const orders = await getMyCustomerOrders(ctx.session.userId);
      return orders.slice(0, 5).map((order) => ({
        number: order.order_number,
        dukan: order.shop_name,
        status: order.status,
        total: formatRs(order.total_paisa),
        items: order.items_count,
      }));
    },
  },
];

// ---- Distributor ------------------------------------------------------------------------------

const distributorTools: Tool[] = [
  {
    declaration: {
      name: "today_summary",
      description:
        "Today's orders, this month's sales against last month, money to collect, overdue, and stock running out.",
    },
    run: async (_args, ctx) => {
      const orgId = ctx.contextId ?? "";
      const [dash, insights] = await Promise.all([getDashboard(orgId), getInsights(orgId)]);
      return {
        orders_today: dash.today_orders,
        value_today: formatRs(dash.today_value_paisa),
        new_waiting: dash.new_orders,
        need_a_call: dash.needs_confirmation,
        to_dispatch: dash.to_dispatch,
        out_for_delivery: dash.out_for_delivery,
        to_collect: formatRs(dash.receivable_paisa),
        overdue: formatRs(dash.overdue_paisa),
        month_sales: formatRs(insights.mtd.sales_paisa),
        last_month_same_days: formatRs(insights.mtd.prev_sales_paisa),
        running_low: insights.running_low.map(
          (item) => `${item.name} (${item.days_left} days left)`,
        ),
        quiet_dukans: insights.inactive_shops.map((shop) => shop.name),
      };
    },
  },
  {
    declaration: {
      name: "pending_orders",
      description: "New orders from dukans waiting for the distributor, newest first.",
    },
    run: async (_args, ctx) => {
      const inbox = await getInbox(ctx.contextId ?? "", "new");
      return inbox.orders.slice(0, 8).map((order) => ({
        number: order.order_number,
        dukan: order.shop.name,
        total: formatRs(order.total_paisa),
        items: order.item_count,
      }));
    },
  },
];

function toolsFor(role: AppRole): Tool[] {
  const base =
    role === "dukandar"
      ? dukandarTools
      : role === "customer"
        ? customerTools
        : role === "distributor"
          ? distributorTools
          : [];
  const open = openScreenTool(role);
  return open ? [...base, open] : base;
}

function systemPrompt(
  session: ShellSession,
  contextName: string | null,
  screen: string | undefined,
): string {
  return `You are Tez, the helper inside the TezDukan app. You talk to ${session.fullName}, who is
using the app as a ${session.activeRole}${contextName ? ` for "${contextName}"` : ""}. They are on the
screen ${screen ?? "unknown"}.

How to answer:
- Reply in the language and script the person used: Roman Urdu for Roman Urdu, Urdu script for
  Urdu, English for English. Many are shopkeepers who read slowly: short sentences, under 60
  words, numbers as digits, money as "Rs 1,250". Plain text only: no markdown, no asterisks.
- Use the tools for any number, order, product or price. Never make one up. If a tool fails or
  returns nothing, say so plainly.
- When they ask to change a price or stock or to add products, do it with the tools (find the
  product first) and then say exactly what changed. If two products match, ask which one.
- When a screen does what they want, call open_screen so they get a button.
- When a customer asks for things ("doodh aur double roti mangwa do"), search for each, pick
  the best match from one nearby dukan, add them with add_to_cart, then say what you added and
  from which dukan. If nothing matches, say so and suggest a close item.
- Call several tools at once when you need several facts.
- Only help with TezDukan and their shop. For anything else, say politely that you can only
  help with TezDukan.

What TezDukan does:
${TEZDUKAN_KNOWLEDGE}`;
}

export const historySchema = z
  .array(z.object({ role: z.enum(["user", "munshi"]), text: z.string().trim().min(1).max(2000) }))
  .max(12)
  .default([]);
export type MunshiHistory = z.infer<typeof historySchema>;

const MAX_STEPS = 5;

/** Answers one message, calling tools as needed (at most a few rounds). */
export async function runMunshi({
  session,
  message,
  history,
  screen,
}: {
  session: ShellSession;
  message: string;
  history: MunshiHistory;
  screen?: string;
}): Promise<MunshiAnswer> {
  const context = session.contexts.find(
    (c) => c.role === session.activeRole && c.contextId === session.activeContextId,
  );
  const ctx: ToolContext = {
    session,
    contextId: session.activeContextId,
    found: new Map(),
    cart: [],
  };
  const tools = toolsFor(session.activeRole);
  const byName = new Map(tools.map((tool) => [tool.declaration.name, tool]));
  const contents: GeminiContent[] = [
    ...history.map((turn) => ({
      role: turn.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  let link: MunshiLink | null = null;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const result = await geminiGenerate({
      system: systemPrompt(session, context?.name ?? null, screen),
      contents,
      tools: tools.map((tool) => tool.declaration),
    });
    if (result.calls.length === 0) {
      // Something went into the cart: offer the cart button unless another screen was chosen.
      const cartLink =
        ctx.cart.length > 0 && !link && screens.customer?.cart
          ? { screen: "cart", href: screens.customer.cart }
          : link;
      return { reply: plain(result.text), link: cartLink, cart: ctx.cart };
    }
    contents.push({ role: "model", parts: result.parts });
    // Independent tool calls run together, so a question that needs three facts waits once.
    const responses = await Promise.all(
      result.calls.map(async (call) => {
        const tool = byName.get(call.name);
        let output: unknown;
        try {
          output = tool ? await tool.run(call.args, ctx) : { error: "unknown_tool" };
          if (call.name === "open_screen" && tool) {
            const screenName = String(call.args.screen);
            const href = screens[session.activeRole]?.[screenName];
            if (href) link = { screen: screenName, href };
          }
        } catch (error) {
          output = { error: error instanceof Error ? error.message : "failed" };
        }
        return {
          functionResponse: {
            ...(call.id ? { id: call.id } : {}),
            name: call.name,
            response: { result: output },
          },
        };
      }),
    );
    contents.push({ role: "user", parts: responses });
  }
  return { reply: "", link, cart: ctx.cart };
}
