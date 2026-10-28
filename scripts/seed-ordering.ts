/**
 * Phase 2 seed: dukandar ordering (PLAN.md §6.5, Phase 2).
 *
 * - Mehran Distributors (Qasimabad): about 60% of the catalog at slightly different prices, its
 *   own minimum order and delivery fee, a slab scheme and a flat scheme, so the cart visibly
 *   splits by distributor.
 * - Indus Traders: a key-account price tier for TezDukan and real stock in its warehouse.
 * - Dukan-home banners with the owner's Stitch artwork.
 * - With demo users: eight TezDukan orders over the last three weeks across both distributors
 *   (new, confirmed, dispatched, delivered, partially delivered, cancelled) with their invoices,
 *   a payment and a credit note in the distributors' ledgers, so order history, reorder,
 *   trending and the distributor ledger all have real data.
 * Pure data + builders, no I/O: scripts/seed.ts writes it. Every id is deterministic (UUID v5).
 * Prices are SAMPLE values in integer paisa. All maths here mirrors private.price_cart.
 */
import type { Database } from "../src/lib/supabase/database.types";
import {
  areaId,
  brandId,
  categoryId,
  DEMO_USERS,
  distributorProductId,
  findProduct,
  KEY_ACCOUNT_TIER_ID,
  ORG_ID,
  productDefs,
  rs,
  SEED_IMAGE_DIR,
  seedId,
  SHOP_ID,
  WAREHOUSE_ID,
  type ProductDef,
  type ProductKey,
  type SeedRow,
} from "./seed-data";

type Enums = Database["public"]["Enums"];
type PackUnitKind = Enums["pack_unit_kind"];
type OrderStatus = Enums["order_status"];

// ------------------------------------------------------------------------------------------------
// Time helpers: "N days ago at HH:MM Karachi time" (UTC+5, no DST).
// ------------------------------------------------------------------------------------------------

const PKT_OFFSET_MS = 5 * 3_600_000;

function pktAt(daysAgo: number, hour: number, minute = 0): Date {
  const nowPkt = new Date(Date.now() + PKT_OFFSET_MS);
  const day = Date.UTC(
    nowPkt.getUTCFullYear(),
    nowPkt.getUTCMonth(),
    nowPkt.getUTCDate() - daysAgo,
  );
  return new Date(day + hour * 3_600_000 + minute * 60_000 - PKT_OFFSET_MS);
}

/** Calendar date (YYYY-MM-DD) in Karachi for an instant. */
function pktDate(at: Date): string {
  return new Date(at.getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------------------------------------
// Indus Traders: key-account price tier (TezDukan's retailer account points at it)
// ------------------------------------------------------------------------------------------------

const keyAccountKeys: ProductKey[] = [
  "tapal-danedar-950g",
  "lipton-yellow-label-950g",
  "olpers-1l",
  "milkpak-1l",
  "dalda-oil-1l",
  "dalda-oil-5l",
  "surf-excel-1kg",
  "shan-biryani-50g",
];

/** Key-account price: 1.5% under trade, to the rupee. */
const keyAccountPrice = (def: ProductDef): number => rs(Math.round(def.trade * 0.985));

export const priceTiers: SeedRow<"price_tiers">[] = [
  {
    id: KEY_ACCOUNT_TIER_ID,
    org_id: ORG_ID,
    name: "Key accounts",
    description: "Gold retailers ordering twice a week.",
    kind: "segment",
    segment: "gold",
    area_id: null,
    priority: 10,
    is_active: true,
  },
];

export const priceTierItems: SeedRow<"price_tier_items">[] = keyAccountKeys.map((key) => ({
  id: seedId(`price-tier-item:key-account:${key}`),
  price_tier_id: KEY_ACCOUNT_TIER_ID,
  distributor_product_id: distributorProductId(key),
  org_id: ORG_ID,
  price_paisa: keyAccountPrice(findProduct(key)),
}));

// ------------------------------------------------------------------------------------------------
// Mehran Distributors (Qasimabad)
// ------------------------------------------------------------------------------------------------

export const MEHRAN_ORG_ID = seedId("org:mehran-distributors");
const MEHRAN_WAREHOUSE_ID = seedId("warehouse:mehran-distributors:main");

const mehranForced: ProductKey[] = [
  "tapal-danedar-950g",
  "olpers-1l",
  "dalda-oil-1l",
  "shan-biryani-50g",
  "national-biryani-50g",
  "surf-excel-1kg",
];
/** About 60% of the catalog: every product at positions 0, 2 and 4 of each five, plus staples. */
const mehranDefs: ProductDef[] = productDefs.filter(
  (def, index) =>
    index % 5 === 0 || index % 5 === 2 || index % 5 === 4 || mehranForced.includes(def.key),
);
const mehranFactors = [0.98, 1.02, 0.99, 1.03, 0.97];
/** Mehran's trade price per piece: within 3% of Indus Traders, always under MRP. */
const mehranTrade = (def: ProductDef): number => {
  const index = productDefs.indexOf(def);
  const price = rs(Math.round(def.trade * (mehranFactors[index % mehranFactors.length] ?? 1)));
  return price < rs(def.mrp) ? price : rs(def.trade);
};
const mehranProductId = (key: ProductKey): string => seedId(`distributor-product:mehran:${key}`);

export const mehranOrganizations: SeedRow<"organizations">[] = [
  {
    id: MEHRAN_ORG_ID,
    name: "Mehran Distributors",
    slug: "mehran-distributors",
    legal_name: "Mehran Distributors (Pvt) Ltd",
    description: "Tea, spices, dairy and home care for kiryana stores, delivered from Qasimabad.",
    phone: "+922232654400",
    email: "orders@mehran.example.pk",
    ntn: "7654321-0",
    strn: "17-00-7654-321-01",
    address_line: "Plot 14, Main Qasimabad Road, near Naseem Nagar Chowk, Hyderabad",
    area_id: areaId("qasimabad"),
    lat: 25.4012,
    lng: 68.3301,
    served_area_ids: null,
    logo_path: null,
    cover_path: null,
    status: "approved",
    submitted_at: "2026-09-10T05:00:00Z",
    approved_at: "2026-09-11T06:30:00Z",
    min_order_paisa: rs(5000),
    delivery_fee_paisa: rs(150),
    free_delivery_above_paisa: rs(15000),
    settings: {
      order_cutoff_time: "16:00",
      delivery_days: [1, 2, 3, 4, 6, 7],
      default_credit_limit_paisa: rs(30000),
      default_payment_terms_days: 10,
      overdue_hold_days: 21,
      enforce_stock: true,
    },
  },
];

export const mehranWarehouses: SeedRow<"warehouses">[] = [
  {
    id: MEHRAN_WAREHOUSE_ID,
    org_id: MEHRAN_ORG_ID,
    name: "Qasimabad godown",
    code: "QSM",
    address_line: "Godown 2, Main Qasimabad Road, Hyderabad",
    area_id: areaId("qasimabad"),
    lat: 25.4016,
    lng: 68.3296,
    is_default: true,
    is_active: true,
  },
];

export const mehranProducts: SeedRow<"distributor_products">[] = mehranDefs.map((def) => ({
  id: mehranProductId(def.key),
  org_id: MEHRAN_ORG_ID,
  master_product_id: seedId(`master-product:${def.key}`),
  name: `${def.name} ${def.packSize}`,
  name_ur: def.nameUr,
  sku: `MD-${def.sku}`,
  barcode: null,
  brand_id: def.brand ? brandId(def.brand) : null,
  category_id: categoryId(def.category),
  description: null,
  pack_size_label: def.packSize,
  image_path: null,
  mrp_paisa: rs(def.mrp),
  trade_price_paisa: mehranTrade(def),
  moq_base_qty: def.moq ?? 1,
  visible_area_ids: null,
  is_active: true,
}));

/** Pack units for one distributor's copy of a product: piece, the inner pack, the carton. */
function packUnitsFor(
  def: ProductDef,
  orgId: string,
  productId: string,
  idPrefix: string,
): SeedRow<"pack_units">[] {
  const rows: SeedRow<"pack_units">[] = [
    {
      id: seedId(`${idPrefix}:${def.key}:piece`),
      distributor_product_id: productId,
      org_id: orgId,
      unit: "piece",
      label: "Piece",
      base_qty: 1,
      barcode: null,
      is_default: false,
    },
  ];
  if (def.inner) {
    rows.push({
      id: seedId(`${idPrefix}:${def.key}:${def.inner.kind}`),
      distributor_product_id: productId,
      org_id: orgId,
      unit: def.inner.kind,
      label: def.inner.kind === "dozen" ? "Dozen (12 pcs)" : `Box (${def.inner.qty} pcs)`,
      base_qty: def.inner.qty,
      barcode: null,
      is_default: true,
    });
  }
  if (def.carton > 1) {
    rows.push({
      id: seedId(`${idPrefix}:${def.key}:carton`),
      distributor_product_id: productId,
      org_id: orgId,
      unit: "carton",
      label: `Carton (${def.carton} pcs)`,
      base_qty: def.carton,
      barcode: null,
      is_default: !def.inner,
    });
  }
  if (rows.length === 1 && rows[0]) rows[0].is_default = true;
  return rows;
}

export const mehranPackUnits: SeedRow<"pack_units">[] = mehranDefs.flatMap((def) =>
  packUnitsFor(def, MEHRAN_ORG_ID, mehranProductId(def.key), "pack:mehran"),
);

const today = new Date();
const plusDays = (days: number): string =>
  new Date(today.getTime() + days * 86_400_000).toISOString();

const MEHRAN_SLAB_ID = seedId("scheme:mehran:tapal-slab");
const MEHRAN_FLAT_ID = seedId("scheme:mehran:masala-5");

export const mehranSchemes: SeedRow<"schemes">[] = [
  {
    id: MEHRAN_SLAB_ID,
    org_id: MEHRAN_ORG_ID,
    name: "Tapal Danedar: 2% off 24+, 3% off 48+",
    name_ur: "ٹپال دانے دار: 24 پر 2٪، 48 پر 3٪ رعایت",
    description: "Bulk discount on Tapal Danedar 950 g by pieces in one order.",
    kind: "slab_discount",
    rules: {
      basis: "quantity",
      slabs: [
        { min: 24, discount_bps: 200 },
        { min: 48, discount_bps: 300 },
      ],
    },
    area_ids: null,
    segments: null,
    starts_at: today.toISOString(),
    ends_at: plusDays(45),
    is_active: true,
    priority: 0,
  },
  {
    id: MEHRAN_FLAT_ID,
    org_id: MEHRAN_ORG_ID,
    name: "Biryani masala: 5% off",
    name_ur: "بریانی مصالحہ: 5٪ رعایت",
    description: "5% off Shan and National biryani masala this month.",
    kind: "flat_discount",
    rules: { discount_bps: 500 },
    area_ids: null,
    segments: null,
    starts_at: today.toISOString(),
    ends_at: plusDays(30),
    is_active: true,
    priority: 0,
  },
];

export const mehranSchemeProducts: SeedRow<"scheme_products">[] = [
  {
    id: seedId("scheme-product:mehran-tapal-slab:trigger"),
    scheme_id: MEHRAN_SLAB_ID,
    distributor_product_id: mehranProductId("tapal-danedar-950g"),
    org_id: MEHRAN_ORG_ID,
    role: "trigger",
  },
  ...(["shan-biryani-50g", "national-biryani-50g"] as const).map((key) => ({
    id: seedId(`scheme-product:mehran-masala-5:${key}`),
    scheme_id: MEHRAN_FLAT_ID,
    distributor_product_id: mehranProductId(key),
    org_id: MEHRAN_ORG_ID,
    role: "trigger" as const,
  })),
];

export const mehranRetailerAccounts: SeedRow<"retailer_accounts">[] = [
  {
    id: seedId("retailer-account:mehran:tezdukan"),
    org_id: MEHRAN_ORG_ID,
    shop_id: SHOP_ID,
    price_tier_id: null,
    segment: "Regular",
    credit_limit_paisa: rs(100000),
    payment_terms_days: 10,
    status: "active",
    hold_reason: null,
    hold_override_until: null,
    assigned_booker_id: null,
    notes: "New account since September.",
  },
];

// ------------------------------------------------------------------------------------------------
// Stock: both warehouses. A few products are out of stock on purpose.
// ------------------------------------------------------------------------------------------------

const indusOutOfStock: ProductKey[] = [
  "nescafe-classic-50g",
  "haleeb-1l",
  "sensodyne-fresh-mint-70g",
];
const mehranOutOfStock: ProductKey[] = ["lifebuoy-total-128g", "aquafina-1500ml"];
const shortShelfLife = new Set(["dairy", "water", "beverages"]);

function stockFor(
  defs: ProductDef[],
  orgId: string,
  warehouseId: string,
  productId: (key: ProductKey) => string,
  price: (def: ProductDef) => number,
  outOfStock: ProductKey[],
  prefix: string,
): { batches: SeedRow<"stock_batches">[]; movements: SeedRow<"stock_movements">[] } {
  const batches: SeedRow<"stock_batches">[] = [];
  const movements: SeedRow<"stock_movements">[] = [];
  defs.forEach((def, index) => {
    if (outOfStock.includes(def.key)) return;
    const qty = Math.max(def.carton, 12) * (4 + (index % 5));
    const batchId = seedId(`stock-batch:${prefix}:${def.key}`);
    const receivedAt = pktAt(12 + (index % 6), 9).toISOString();
    batches.push({
      id: batchId,
      org_id: orgId,
      warehouse_id: warehouseId,
      distributor_product_id: productId(def.key),
      receipt_id: null,
      batch_no: `B${2600 + index}`,
      expiry_date: addDays(pktDate(new Date()), shortShelfLife.has(def.category) ? 75 : 320),
      qty_on_hand: qty,
      qty_reserved: 0,
      unit_cost_paisa: Math.round(price(def) * 0.95),
      bin_location: `R${1 + (index % 6)}-S${1 + (index % 4)}`,
      received_at: receivedAt,
      created_at: receivedAt,
    });
    movements.push({
      id: seedId(`stock-movement:${prefix}:${def.key}:in`),
      org_id: orgId,
      warehouse_id: warehouseId,
      batch_id: batchId,
      distributor_product_id: productId(def.key),
      movement_type: "stock_in",
      quantity: qty,
      unit_cost_paisa: Math.round(price(def) * 0.95),
      reference_type: "seed",
      reference_id: null,
      reason: "Opening stock",
      created_at: receivedAt,
    });
  });
  return { batches, movements };
}

const indusStock = stockFor(
  productDefs,
  ORG_ID,
  WAREHOUSE_ID,
  distributorProductId,
  (def) => rs(def.trade),
  indusOutOfStock,
  "indus",
);
const mehranStock = stockFor(
  mehranDefs,
  MEHRAN_ORG_ID,
  MEHRAN_WAREHOUSE_ID,
  mehranProductId,
  mehranTrade,
  mehranOutOfStock,
  "mehran",
);
export const stockBatches = [...indusStock.batches, ...mehranStock.batches];
export const stockMovements = [...indusStock.movements, ...mehranStock.movements];

// ------------------------------------------------------------------------------------------------
// Dukan-home banners (platform)
// ------------------------------------------------------------------------------------------------

export const banners: SeedRow<"banners">[] = [
  {
    id: seedId("banner:dukan-home:restock"),
    owner_type: "platform",
    org_id: null,
    title: "Restock today, delivered tomorrow",
    title_ur: "آج آرڈر کریں، کل ڈیلیوری",
    subtitle: "Order before the cutoff and your stock reaches the shop by morning.",
    image_path: `${SEED_IMAGE_DIR}/banners/rider.webp`,
    link: "/dukan/distributors",
    placement: "dukan_home",
    area_ids: null,
    segments: null,
    starts_at: "2026-10-01T00:00:00Z",
    ends_at: null,
    is_active: true,
    sort_order: 1,
  },
  {
    id: seedId("banner:dukan-home:chai-ghee"),
    owner_type: "platform",
    org_id: null,
    title: "Chai and ghee savings",
    title_ur: "چائے اور گھی پر بچت",
    subtitle: "Olper's 12 + 1 free and bulk prices on Tapal and Dalda.",
    image_path: `${SEED_IMAGE_DIR}/banners/kitchen.webp`,
    link: "/dukan/categories/tea-coffee",
    placement: "dukan_home",
    area_ids: null,
    segments: null,
    starts_at: "2026-10-01T00:00:00Z",
    ends_at: null,
    is_active: true,
    sort_order: 2,
  },
  {
    id: seedId("banner:dukan-home:wholesale"),
    owner_type: "platform",
    org_id: null,
    title: "Wholesale prices from two distributors",
    title_ur: "دو ڈسٹری بیوٹرز سے ہول سیل ریٹ",
    subtitle: "Compare Indus Traders and Mehran on every product.",
    image_path: `${SEED_IMAGE_DIR}/banners/warehouse.webp`,
    link: "/dukan/distributors",
    placement: "dukan_home",
    area_ids: null,
    segments: null,
    starts_at: "2026-10-01T00:00:00Z",
    ends_at: null,
    is_active: true,
    sort_order: 3,
  },
];

// ------------------------------------------------------------------------------------------------
// Order history (demo users only): eight TezDukan orders over three weeks.
// ------------------------------------------------------------------------------------------------

type Distributor = "indus" | "mehran";

interface HistoryLine {
  key: ProductKey;
  unit: PackUnitKind;
  qty: number;
  /** Pieces that did not arrive (partial delivery). */
  shortPieces?: number;
}

interface HistoryOrder {
  number: number;
  org: Distributor;
  placed: [daysAgo: number, hour: number];
  status: OrderStatus;
  payment: Enums["order_payment_method"];
  lines: HistoryLine[];
  delivered?: [daysAgo: number, hour: number];
  rating?: { stars: number; comment: string };
  cancel?: { daysAgo: number; reason: string };
  viaBooker?: boolean;
}

const historyOrders: HistoryOrder[] = [
  {
    number: 101,
    org: "indus",
    placed: [20, 11],
    status: "delivered",
    payment: "credit",
    delivered: [19, 10],
    lines: [
      { key: "tapal-danedar-950g", unit: "carton", qty: 1 },
      { key: "olpers-1l", unit: "piece", qty: 24 },
      { key: "dalda-oil-1l", unit: "piece", qty: 12 },
      { key: "surf-excel-1kg", unit: "piece", qty: 10 },
    ],
  },
  {
    number: 102,
    org: "mehran",
    placed: [17, 15],
    status: "delivered",
    payment: "cod",
    delivered: [16, 12],
    rating: { stars: 4, comment: "Saman theek tha, delivery thori late." },
    lines: [
      { key: "shan-biryani-50g", unit: "piece", qty: 24 },
      { key: "national-biryani-50g", unit: "piece", qty: 12 },
      { key: "tapal-danedar-950g", unit: "piece", qty: 12 },
    ],
  },
  {
    number: 103,
    org: "indus",
    placed: [13, 10],
    status: "partially_delivered",
    payment: "credit",
    delivered: [12, 11],
    lines: [
      { key: "lipton-yellow-label-950g", unit: "piece", qty: 12 },
      { key: "milkpak-1l", unit: "piece", qty: 24, shortPieces: 4 },
      { key: "dalda-oil-5l", unit: "piece", qty: 4 },
      { key: "lays-salted-40g", unit: "piece", qty: 24 },
    ],
  },
  {
    number: 104,
    org: "indus",
    placed: [7, 18],
    status: "delivered",
    payment: "credit",
    delivered: [5, 10],
    rating: { stars: 5, comment: "Waqt par delivery, sab kuch poora." },
    lines: [
      { key: "tapal-danedar-950g", unit: "carton", qty: 1 },
      { key: "olpers-1l", unit: "piece", qty: 36 },
      { key: "shan-biryani-50g", unit: "piece", qty: 24 },
      { key: "coca-cola-1500ml", unit: "piece", qty: 12 },
    ],
  },
  {
    number: 105,
    org: "mehran",
    placed: [6, 12],
    status: "cancelled",
    payment: "cod",
    cancel: { daysAgo: 6, reason: "Ordered twice by mistake" },
    lines: [
      { key: "surf-excel-1kg", unit: "piece", qty: 12 },
      { key: "dalda-oil-1l", unit: "piece", qty: 12 },
    ],
  },
  {
    number: 106,
    org: "indus",
    placed: [2, 11],
    status: "dispatched",
    payment: "credit",
    viaBooker: true,
    lines: [
      { key: "olpers-1l", unit: "piece", qty: 24 },
      { key: "milkpak-1l", unit: "piece", qty: 24 },
      { key: "surf-excel-1kg", unit: "piece", qty: 12 },
    ],
  },
  {
    number: 107,
    org: "mehran",
    placed: [1, 16],
    status: "confirmed",
    payment: "cod",
    lines: [
      { key: "tapal-danedar-950g", unit: "piece", qty: 24 },
      { key: "shan-biryani-50g", unit: "piece", qty: 12 },
    ],
  },
  {
    number: 108,
    org: "indus",
    placed: [0, 9],
    status: "new",
    payment: "credit",
    lines: [
      { key: "dalda-oil-1l", unit: "piece", qty: 12 },
      { key: "tapal-danedar-950g", unit: "piece", qty: 12 },
    ],
  },
];

/** Highest order number used by the seed; the order_number counter starts after it. */
export const LAST_SEED_ORDER_NUMBER = 108;

const distributorOf = {
  indus: {
    orgId: ORG_ID,
    terms: 15,
    deliveryFee: 0,
    freeAbove: null as number | null,
    productId: distributorProductId,
    packPrefix: "pack",
    piecePrice: (def: ProductDef) =>
      keyAccountKeys.includes(def.key) ? keyAccountPrice(def) : rs(def.trade),
    scheme: (def: ProductDef) =>
      def.key === "olpers-1l"
        ? {
            id: seedId("scheme:indus-traders:olpers-12-plus-1"),
            kind: "buy_x_get_y" as const,
          }
        : null,
  },
  mehran: {
    orgId: MEHRAN_ORG_ID,
    terms: 10,
    deliveryFee: rs(150),
    freeAbove: rs(15000) as number | null,
    productId: mehranProductId,
    packPrefix: "pack:mehran",
    piecePrice: mehranTrade,
    scheme: (def: ProductDef) =>
      def.key === "tapal-danedar-950g"
        ? { id: MEHRAN_SLAB_ID, kind: "slab_discount" as const }
        : def.key === "shan-biryani-50g" || def.key === "national-biryani-50g"
          ? { id: MEHRAN_FLAT_ID, kind: "flat_discount" as const }
          : null,
  },
};

/** Same maths as private.scheme_line_effect for the seeded schemes. */
function schemeEffect(
  kind: "buy_x_get_y" | "slab_discount" | "flat_discount",
  baseQty: number,
  gross: number,
): { free: number; discount: number } {
  if (kind === "buy_x_get_y") return { free: Math.floor(baseQty / 12), discount: 0 };
  if (kind === "slab_discount") {
    const bps = baseQty >= 48 ? 300 : baseQty >= 24 ? 200 : 0;
    return { free: 0, discount: Math.floor((gross * bps) / 10000) };
  }
  return { free: 0, discount: Math.floor((gross * 500) / 10000) };
}

function baseQtyOf(def: ProductDef, unit: PackUnitKind): number {
  if (unit === "piece") return 1;
  if (unit === "carton") return def.carton;
  if (def.inner && def.inner.kind === unit) return def.inner.qty;
  throw new Error(`${def.key} has no ${unit} pack`);
}

export interface OrderHistory {
  orders: SeedRow<"orders">[];
  orderItems: SeedRow<"order_items">[];
  statusHistory: SeedRow<"order_status_history">[];
  deliveryOtps: SeedRow<"delivery_otps">[];
  ledgerAccounts: SeedRow<"ledger_accounts">[];
  ledgerJournals: SeedRow<"ledger_journals">[];
  ledgerEntries: SeedRow<"ledger_entries">[];
  payments: SeedRow<"payments">[];
  paymentAllocations: SeedRow<"payment_allocations">[];
  creditNotes: SeedRow<"credit_notes">[];
  reviews: SeedRow<"reviews">[];
}

export function buildOrderHistory(): OrderHistory {
  const out: OrderHistory = {
    orders: [],
    orderItems: [],
    statusHistory: [],
    deliveryOtps: [],
    ledgerAccounts: [],
    ledgerJournals: [],
    ledgerEntries: [],
    payments: [],
    paymentAllocations: [],
    creditNotes: [],
    reviews: [],
  };
  const dukandar = DEMO_USERS.dukandar;
  const booker = DEMO_USERS.booker;
  const bookerMemberId = seedId(`org-member:indus-traders:${booker.key}`);

  // Distributor books: receivable for TezDukan, sales, cash and sales returns.
  const account = (org: Distributor, code: Enums["ledger_account_code"]): string =>
    seedId(`ledger-account:${org}:${code}${code === "receivable" ? ":tezdukan" : ""}`);
  for (const org of ["indus", "mehran"] as const) {
    for (const code of ["receivable", "sales", "cash", "sales_returns"] as const) {
      out.ledgerAccounts.push({
        id: account(org, code),
        book_type: "org",
        org_id: distributorOf[org].orgId,
        shop_id: null,
        code,
        name:
          code === "receivable"
            ? "Receivable: TezDukan"
            : code.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()),
        counterparty_type: code === "receivable" ? "shop" : null,
        counterparty_shop_id: code === "receivable" ? SHOP_ID : null,
        counterparty_customer_id: null,
        is_active: true,
      });
    }
  }

  const journal = (
    key: string,
    org: Distributor,
    at: Date,
    memo: string,
    reference: { type: string; id: string },
    lines: { account: string; debit: number; credit: number; dueDate?: string }[],
  ): string => {
    const journalId = seedId(`journal:${key}`);
    const entryDate = pktDate(at);
    out.ledgerJournals.push({
      id: journalId,
      book_type: "org",
      org_id: distributorOf[org].orgId,
      shop_id: null,
      entry_date: entryDate,
      memo,
      reference_type: reference.type,
      reference_id: reference.id,
      created_at: at.toISOString(),
    });
    lines.forEach((line, index) => {
      out.ledgerEntries.push({
        id: seedId(`journal:${key}:line:${index}`),
        journal_id: journalId,
        account_id: line.account,
        book_type: "org",
        org_id: distributorOf[org].orgId,
        debit_paisa: line.debit,
        credit_paisa: line.credit,
        entry_date: entryDate,
        due_date: line.dueDate ?? null,
        memo,
        reference_type: reference.type,
        reference_id: reference.id,
        created_at: at.toISOString(),
      });
    });
    return journalId;
  };

  for (const h of historyOrders) {
    const d = distributorOf[h.org];
    const orderId = seedId(`order:tezdukan:${h.number}`);
    const orderNumber = `TD-${String(h.number).padStart(6, "0")}`;
    const placedAt = pktAt(h.placed[0], h.placed[1], 15);
    const deliveredAt = h.delivered ? pktAt(h.delivered[0], h.delivered[1], 30) : null;

    let subtotal = 0;
    let schemeDiscount = 0;
    let invoicedSubtotal = 0;
    h.lines.forEach((line, index) => {
      const def = findProduct(line.key);
      const baseQtyPerUnit = baseQtyOf(def, line.unit);
      const piecePrice = d.piecePrice(def);
      const unitPrice = piecePrice * baseQtyPerUnit;
      const baseQty = line.qty * baseQtyPerUnit;
      const gross = line.qty * unitPrice;
      const scheme = d.scheme(def);
      const effect = scheme ? schemeEffect(scheme.kind, baseQty, gross) : { free: 0, discount: 0 };
      const lineTotal = gross - effect.discount;
      subtotal += gross;
      schemeDiscount += effect.discount;
      const deliveredBase = deliveredAt ? baseQty - (line.shortPieces ?? 0) : null;
      const invoiced =
        deliveredBase === null ? null : lineTotal - (line.shortPieces ?? 0) * piecePrice;
      invoicedSubtotal += invoiced ?? 0;
      out.orderItems.push({
        id: seedId(`order-item:tezdukan:${h.number}:${index}`),
        order_id: orderId,
        org_id: d.orgId,
        shop_id: SHOP_ID,
        distributor_product_id: d.productId(line.key),
        master_product_id: seedId(`master-product:${line.key}`),
        pack_unit_id: seedId(`${d.packPrefix}:${line.key}:${line.unit}`),
        name: `${def.name} ${def.packSize}`,
        name_ur: def.nameUr,
        sku: h.org === "indus" ? def.sku : `MD-${def.sku}`,
        barcode: null,
        image_path: null,
        category_id: categoryId(def.category),
        pack_unit: line.unit,
        pack_label:
          line.unit === "piece"
            ? "Piece"
            : line.unit === "carton"
              ? `Carton (${def.carton} pcs)`
              : `Box (${baseQtyPerUnit} pcs)`,
        base_qty_per_unit: baseQtyPerUnit,
        quantity: line.qty,
        piece_price_paisa: piecePrice,
        unit_price_paisa: unitPrice,
        mrp_paisa: rs(def.mrp),
        scheme_id: effect.free > 0 || effect.discount > 0 ? (scheme?.id ?? null) : null,
        free_base_qty: effect.free,
        line_discount_paisa: effect.discount,
        line_total_paisa: lineTotal,
        delivered_base_qty: deliveredBase,
        free_delivered_base_qty: deliveredAt ? effect.free : null,
        short_base_qty: line.shortPieces ?? 0,
        invoiced_total_paisa: invoiced,
        created_at: placedAt.toISOString(),
      });
    });

    const net = subtotal - schemeDiscount;
    const deliveryFee = d.freeAbove !== null && net >= d.freeAbove ? 0 : d.deliveryFee;
    const orderedTotal = net + deliveryFee;
    // Delivery restates the order to what was actually delivered (short pieces come off).
    const shortValue = deliveredAt ? net - invoicedSubtotal : 0;
    const total = orderedTotal - shortValue;
    const invoiceDate = deliveredAt ? pktDate(deliveredAt) : null;
    const dueDate = invoiceDate ? addDays(invoiceDate, d.terms) : null;
    const delivered = h.status === "delivered" || h.status === "partially_delivered";
    const reached = (status: OrderStatus): boolean => {
      const flow: OrderStatus[] = ["new", "confirmed", "packed", "dispatched", "delivered"];
      const target = h.status === "partially_delivered" ? "delivered" : h.status;
      return flow.indexOf(status) <= flow.indexOf(target) && flow.indexOf(target) >= 0;
    };
    const step = (hours: number): string =>
      new Date(placedAt.getTime() + hours * 3_600_000).toISOString();
    const confirmedAt = reached("confirmed") ? step(1.5) : null;
    const packedAt = reached("packed") ? step(4) : null;
    const dispatchedAt = reached("dispatched")
      ? deliveredAt
        ? new Date(deliveredAt.getTime() - 2 * 3_600_000).toISOString()
        : step(20)
      : null;

    let paid = 0;
    if (h.payment === "cod" && delivered) paid = total;
    if (h.number === 101) paid = Math.floor((total * 0.6) / 100_000) * 100_000;

    out.orders.push({
      id: orderId,
      order_number: orderNumber,
      shop_id: SHOP_ID,
      org_id: d.orgId,
      warehouse_id: h.org === "indus" ? WAREHOUSE_ID : MEHRAN_WAREHOUSE_ID,
      placed_by: h.viaBooker ? booker.id : dukandar.id,
      placed_by_name: h.viaBooker ? booker.fullName : dukandar.fullName,
      booker_id: h.viaBooker ? bookerMemberId : null,
      source: h.viaBooker ? "booker" : "app",
      status: h.status,
      payment_method: h.payment,
      payment_status: paid === 0 ? "unpaid" : paid >= total ? "paid" : "partially_paid",
      subtotal_paisa: subtotal - shortValue,
      discount_paisa: 0,
      scheme_discount_paisa: schemeDiscount,
      delivery_fee_paisa: deliveryFee,
      total_paisa: total,
      ordered_total_paisa: orderedTotal,
      paid_paisa: paid,
      // The slot the shop chose: 10 am to 12 noon on the day after the order (Karachi time).
      delivery_slot_start: pktAt(h.placed[0] - 1, 10).toISOString(),
      delivery_slot_end: pktAt(h.placed[0] - 1, 12).toISOString(),
      delivery_address: {
        shop_name: "TezDukan",
        line1: "Shop 12, Main Road, Latifabad Unit 6, Hyderabad",
        lat: 25.3735,
        lng: 68.3875,
      },
      notes: h.number === 104 ? "Subah 11 baje se pehle." : null,
      cancel_reason: h.cancel?.reason ?? null,
      cancelled_by: h.cancel ? dukandar.id : null,
      confirmed_at: confirmedAt,
      packed_at: packedAt,
      dispatched_at: dispatchedAt,
      delivered_at: deliveredAt?.toISOString() ?? null,
      cancelled_at: h.cancel ? pktAt(h.cancel.daysAgo, h.placed[1] + 1).toISOString() : null,
      received_at: deliveredAt?.toISOString() ?? null,
      received_by: deliveredAt ? dukandar.id : null,
      invoice_number: invoiceDate ? `INV-${String(h.number).padStart(6, "0")}` : null,
      invoiced_at: deliveredAt?.toISOString() ?? null,
      due_date: dueDate,
      rating: h.rating?.stars ?? null,
      created_at: placedAt.toISOString(),
    });

    // Status history, oldest first.
    const history: [OrderStatus | null, OrderStatus, string | null][] = [
      [null, "new", placedAt.toISOString()],
    ];
    if (h.cancel)
      history.push(["new", "cancelled", pktAt(h.cancel.daysAgo, h.placed[1] + 1).toISOString()]);
    else {
      if (confirmedAt) history.push(["new", "confirmed", confirmedAt]);
      if (packedAt) history.push(["confirmed", "packed", packedAt]);
      if (dispatchedAt) history.push(["packed", "dispatched", dispatchedAt]);
      if (deliveredAt) history.push(["dispatched", h.status, deliveredAt.toISOString()]);
    }
    history.forEach(([from, to, at], index) => {
      out.statusHistory.push({
        id: seedId(`order-history:tezdukan:${h.number}:${index}`),
        order_id: orderId,
        org_id: d.orgId,
        shop_id: SHOP_ID,
        from_status: from,
        to_status: to,
        changed_by:
          to === "new" || to === "cancelled" ? (h.viaBooker ? booker.id : dukandar.id) : null,
        changed_by_name:
          to === "new" || to === "cancelled"
            ? h.viaBooker
              ? booker.fullName
              : dukandar.fullName
            : h.org === "indus"
              ? "Indus Traders"
              : "Mehran Distributors",
        note: to === "cancelled" ? (h.cancel?.reason ?? null) : null,
        created_at: at ?? placedAt.toISOString(),
      });
    });

    if (!h.cancel) {
      out.deliveryOtps.push({
        id: seedId(`delivery-otp:tezdukan:${h.number}`),
        order_id: orderId,
        shop_id: SHOP_ID,
        code: String(1000 + ((h.number * 7919) % 9000)),
        attempts: 0,
        verified_at: deliveredAt?.toISOString() ?? null,
        created_at: placedAt.toISOString(),
      });
    }

    if (deliveredAt && invoiceDate) {
      journal(
        `invoice:${h.number}`,
        h.org,
        deliveredAt,
        `Invoice INV-${String(h.number).padStart(6, "0")} (${orderNumber})`,
        { type: "order", id: orderId },
        [
          {
            account: account(h.org, "receivable"),
            debit: total,
            credit: 0,
            dueDate: dueDate ?? undefined,
          },
          { account: account(h.org, "sales"), debit: 0, credit: total },
        ],
      );
    }

    if (paid > 0 && deliveredAt) {
      const paymentId = seedId(`payment:tezdukan:${h.number}`);
      const receivedAt = h.payment === "cod" ? deliveredAt : pktAt(10, 17);
      const journalId = journal(
        `payment:${h.number}`,
        h.org,
        receivedAt,
        h.payment === "cod"
          ? `Cash on delivery for ${orderNumber}`
          : `Cash received for ${orderNumber}`,
        { type: "payment", id: paymentId },
        [
          { account: account(h.org, "cash"), debit: paid, credit: 0 },
          { account: account(h.org, "receivable"), debit: 0, credit: paid },
        ],
      );
      out.payments.push({
        id: paymentId,
        book_type: "org",
        org_id: d.orgId,
        shop_id: null,
        payer_type: "shop",
        payer_shop_id: SHOP_ID,
        payer_customer_id: null,
        amount_paisa: paid,
        allocated_paisa: paid,
        method: "cash",
        reference_no: h.payment === "cod" ? `COD ${orderNumber}` : `CR-${h.number}`,
        status: "confirmed",
        received_at: receivedAt.toISOString(),
        journal_id: journalId,
        notes:
          h.payment === "cod"
            ? "Collected by the rider at delivery."
            : "Paid at the warehouse counter.",
        created_at: receivedAt.toISOString(),
      });
      out.paymentAllocations.push({
        id: seedId(`payment-allocation:tezdukan:${h.number}`),
        payment_id: paymentId,
        book_type: "org",
        org_id: d.orgId,
        shop_id: null,
        order_id: orderId,
        amount_paisa: paid,
        created_at: receivedAt.toISOString(),
      });
    }

    if (h.number === 103 && deliveredAt) {
      // Six packets of Lay's arrived crushed: credited after the claim.
      const def = findProduct("lays-salted-40g");
      const amount = 6 * d.piecePrice(def);
      const creditNoteId = seedId("credit-note:tezdukan:103");
      const at = pktAt(10, 12);
      const journalId = journal(
        "credit-note:103",
        h.org,
        at,
        `Credit note CN-000103 (${orderNumber}): 6 packets damaged`,
        { type: "credit_note", id: creditNoteId },
        [
          { account: account(h.org, "sales_returns"), debit: amount, credit: 0 },
          { account: account(h.org, "receivable"), debit: 0, credit: amount },
        ],
      );
      out.creditNotes.push({
        id: creditNoteId,
        credit_note_number: "CN-000103",
        org_id: d.orgId,
        shop_id: SHOP_ID,
        order_id: orderId,
        return_id: null,
        amount_paisa: amount,
        reason: "6 packets of Lay's arrived damaged",
        status: "applied",
        journal_id: journalId,
        issued_at: at.toISOString(),
        created_at: at.toISOString(),
      });
    }

    if (h.rating && deliveredAt) {
      out.reviews.push({
        id: seedId(`review:tezdukan:${h.number}`),
        target_type: "organization",
        shop_id: null,
        org_id: d.orgId,
        reviewer_id: dukandar.id,
        reviewer_shop_id: SHOP_ID,
        order_id: orderId,
        rating: h.rating.stars,
        comment: h.rating.comment,
        is_published: true,
        created_at: new Date(deliveredAt.getTime() + 3 * 3_600_000).toISOString(),
      });
    }
  }
  return out;
}
