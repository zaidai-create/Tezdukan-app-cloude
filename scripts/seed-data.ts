/**
 * Seed data for TezDukan (PLAN.md §6.5). Pure data + builders, no I/O: scripts/seed.ts writes it.
 *
 * - Hyderabad city and its zones (approximate real centres).
 * - Master catalog: 13 categories, real Pakistani FMCG brands, at least three real products per
 *   category with SKU, pack size, unit and carton quantity, plus a Roman Urdu / Urdu search lexicon.
 * - One sample distributor (Indus Traders, Latifabad) carrying the whole catalog at editable
 *   trade prices. Prices are realistic late-2026 Hyderabad SAMPLE values in integer paisa; MRP is
 *   always above the trade price. Barcodes use the restricted-circulation EAN-13 range (prefix 2)
 *   because verified product barcodes are not available yet.
 * - One live dukan named "TezDukan" that serves all of Hyderabad, with stock built from the catalog.
 * - Demo users for local development (one per role plus a multi-role user).
 * Image paths are left null on purpose: the UI shows branded initials until real photos exist.
 * Every id is deterministic (UUID v5), so re-running the seed is idempotent.
 */
import { createHash } from "node:crypto";

import type { Database } from "../src/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;
/** An insert row for `T` with a mandatory, deterministic id. */
export type SeedRow<T extends TableName> = Tables[T]["Insert"] & { id: string };
type AppLocale = Database["public"]["Enums"]["app_locale"];
type MeasureUnit = Database["public"]["Enums"]["measure_unit"];
type AppRole = Database["public"]["Enums"]["app_role"];

// ------------------------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------------------------

/** Fixed namespace for TezDukan seed UUIDs (v5). Never change it: ids must stay stable. */
const SEED_NAMESPACE = "2f1d8a64-9c3e-4b57-8e21-7a0c5d9b3e40";

/** Deterministic UUID v5 for a seed key such as "brand:tapal". */
export function seedId(key: string): string {
  const namespace = Buffer.from(SEED_NAMESPACE.replaceAll("-", ""), "hex");
  const hash = createHash("sha1").update(namespace).update(key, "utf8").digest();
  hash.writeUInt8((hash.readUInt8(6) & 0x0f) | 0x50, 6);
  hash.writeUInt8((hash.readUInt8(8) & 0x3f) | 0x80, 8);
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** EAN-13 with check digit for a 12-digit base. */
export function ean13(base12: string): string {
  if (!/^\d{12}$/.test(base12)) throw new Error(`EAN-13 base must be 12 digits: ${base12}`);
  const sum = [...base12].reduce(
    (acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return `${base12}${(10 - (sum % 10)) % 10}`;
}

/** Rupees to integer paisa. */
export const rs = (rupees: number): number => Math.round(rupees * 100);

// ------------------------------------------------------------------------------------------------
// Demo users (local development only; see scripts/seed.ts for when they are created)
// ------------------------------------------------------------------------------------------------

export const DEMO_PASSWORD = "TezDukan-Demo-1";

export interface DemoUser {
  key: string;
  id: string;
  phone: string;
  fullName: string;
  locale: AppLocale;
  holds: string;
}

const demoUser = (
  key: string,
  phone: string,
  fullName: string,
  locale: AppLocale,
  holds: string,
): DemoUser => ({
  key,
  id: seedId(`user:${key}`),
  phone,
  fullName,
  locale,
  holds,
});

export const DEMO_USERS = {
  admin: demoUser(
    "admin",
    "+923000000001",
    "Sana Shaikh",
    "en",
    "Platform admin (user_roles: admin)",
  ),
  dukandar: demoUser(
    "dukandar",
    "+923000000002",
    "Ahmed Raza",
    "ur",
    "Dukandar: owner of TezDukan",
  ),
  distributor: demoUser(
    "distributor",
    "+923000000003",
    "Faisal Memon",
    "en",
    "Distributor: owner of Indus Traders",
  ),
  booker: demoUser(
    "booker",
    "+923000000004",
    "Asif Khoso",
    "ur-Latn",
    "Order booker at Indus Traders",
  ),
  rider: demoUser("rider", "+923000000005", "Imran Soomro", "ur", "Rider at Indus Traders"),
  customer: demoUser("customer", "+923000000006", "Ayesha Siddiqui", "en", "Customer only"),
  multi: demoUser(
    "multi",
    "+923000000007",
    "Kashif Ali",
    "ur-Latn",
    "Multi-role: cashier at TezDukan (shop staff) + manager at Indus Traders (distributor staff)",
  ),
  // A second multi-role account, so parallel end-to-end runs never switch the same profile.
  multi2: demoUser(
    "multi2",
    "+923000000008",
    "Nadia Baloch",
    "en",
    "Multi-role: stock keeper at TezDukan (shop staff) + accountant at Indus Traders",
  ),
} as const;

// ------------------------------------------------------------------------------------------------
// Service areas: Hyderabad and its zones (approximate centres)
// ------------------------------------------------------------------------------------------------

const CITY_ID = seedId("area:hyderabad");

const zones: [
  slug: string,
  name: string,
  nameUr: string,
  lat: number,
  lng: number,
  radiusM: number,
][] = [
  ["latifabad-unit-2", "Latifabad Unit 2", "لطیف آباد یونٹ 2", 25.3835, 68.384, 1200],
  ["latifabad-unit-6", "Latifabad Unit 6", "لطیف آباد یونٹ 6", 25.3735, 68.3875, 1200],
  ["latifabad-unit-7", "Latifabad Unit 7", "لطیف آباد یونٹ 7", 25.37, 68.3925, 1200],
  ["latifabad-unit-8", "Latifabad Unit 8", "لطیف آباد یونٹ 8", 25.3655, 68.388, 1200],
  ["latifabad-unit-10", "Latifabad Unit 10", "لطیف آباد یونٹ 10", 25.3575, 68.3915, 1200],
  ["latifabad-unit-11", "Latifabad Unit 11", "لطیف آباد یونٹ 11", 25.3535, 68.383, 1200],
  ["qasimabad", "Qasimabad", "قاسم آباد", 25.4, 68.33, 2500],
  ["hirabad", "Hirabad", "ہیرآباد", 25.4035, 68.3685, 1500],
  ["saddar", "Saddar", "صدر", 25.3885, 68.372, 1500],
  ["paretabad", "Paretabad", "پریٹ آباد", 25.415, 68.358, 1500],
  ["gulistan-e-sajjad", "Gulistan-e-Sajjad", "گلستانِ سجاد", 25.418, 68.315, 2000],
  ["citizen-colony", "Citizen Colony", "سٹیزن کالونی", 25.41, 68.337, 1500],
  ["auto-bhan-road", "Auto Bhan Road", "آٹو بھان روڈ", 25.393, 68.342, 1500],
  ["hussainabad", "Hussainabad", "حسین آباد", 25.3905, 68.356, 1200],
  ["cantonment", "Cantonment", "کینٹونمنٹ", 25.378, 68.378, 1500],
  ["kohsar", "Kohsar", "کوہسار", 25.356, 68.399, 1500],
];

export const areaId = (slug: string): string => seedId(`area:${slug}`);

export const serviceAreas: SeedRow<"service_areas">[] = [
  {
    id: CITY_ID,
    parent_id: null,
    kind: "city",
    name: "Hyderabad",
    name_ur: "حیدرآباد",
    slug: "hyderabad",
    city: "Hyderabad",
    center_lat: 25.396,
    center_lng: 68.3578,
    radius_m: 15000,
    is_active: true,
    sort_order: 0,
  },
  ...zones.map(([slug, name, nameUr, lat, lng, radiusM], index): SeedRow<"service_areas"> => ({
    id: areaId(slug),
    parent_id: CITY_ID,
    kind: "zone",
    name,
    name_ur: nameUr,
    slug,
    city: "Hyderabad",
    center_lat: lat,
    center_lng: lng,
    radius_m: radiusM,
    is_active: true,
    sort_order: index + 1,
  })),
];

// ------------------------------------------------------------------------------------------------
// Categories and brands
// ------------------------------------------------------------------------------------------------

const categoryDefs = [
  ["tea-coffee", "Tea & Coffee", "چائے اور کافی", "awning"],
  ["dairy", "Dairy", "دودھ اور ڈیری", "mint"],
  ["cooking-oil-ghee", "Cooking Oil & Ghee", "تیل اور گھی", "awning"],
  ["atta-rice-sugar", "Atta, Rice & Sugar", "آٹا، چاول اور چینی", "mint"],
  ["spices-salt", "Spices & Salt", "مصالحے اور نمک", "awning"],
  ["noodles-sauces", "Noodles & Sauces", "نوڈلز اور ساس", "mint"],
  ["biscuits", "Biscuits", "بسکٹ", "awning"],
  ["snacks", "Snacks", "اسنیکس", "mint"],
  ["beverages", "Beverages", "مشروبات", "awning"],
  ["water", "Water", "پانی", "mint"],
  ["detergents", "Detergents", "واشنگ پاؤڈر", "awning"],
  ["soaps", "Soaps", "صابن", "mint"],
  ["oral-care", "Oral Care", "دانتوں کی حفاظت", "awning"],
] as const;

type CategoryKey = (typeof categoryDefs)[number][0];
export const categoryId = (key: CategoryKey): string => seedId(`category:${key}`);

export const categories: SeedRow<"categories">[] = categoryDefs.map(
  ([slug, name, nameUr, tint], index) => ({
    id: categoryId(slug),
    parent_id: null,
    name,
    name_ur: nameUr,
    slug,
    image_path: null,
    tint,
    sort_order: index + 1,
    is_active: true,
  }),
);

const brandDefs = [
  ["tapal", "Tapal", "ٹپال", "Tapal Tea (Pvt) Ltd"],
  ["lipton", "Lipton", "لپٹن", "Unilever Pakistan"],
  ["nestle", "Nestlé", "نیسلے", "Nestlé Pakistan"],
  ["olpers", "Olper's", "اولپرز", "FrieslandCampina Engro Pakistan"],
  ["haleeb", "Haleeb", "حلیب", "Haleeb Foods"],
  ["dalda", "Dalda", "ڈالڈا", "Dalda Foods"],
  ["habib", "Habib", "حبیب", "Habib Oil Mills"],
  ["sunridge", "Sunridge", "سن رج", "Sunridge Foods"],
  ["guard", "Guard", "گارڈ", "Guard Rice"],
  ["falak", "Falak", "فلک", "Falak Rice"],
  ["shan", "Shan", "شان", "Shan Foods"],
  ["national", "National", "نیشنل", "National Foods"],
  ["himalayan-chef", "Himalayan Chef", "ہمالین شیف", "Himalayan Chef"],
  ["knorr", "Knorr", "نور", "Unilever Pakistan"],
  ["shangrila", "Shangrila", "شنگریلا", "Shangrila (Pvt) Ltd"],
  ["peek-freans", "Peek Freans", "پیک فریانز", "English Biscuit Manufacturers"],
  ["lu", "LU", "ایل یو", "Continental Biscuits"],
  ["lays", "Lay's", "لیز", "PepsiCo Pakistan"],
  ["kurkure", "Kurkure", "کرکرے", "PepsiCo Pakistan"],
  ["kolson", "Kolson", "کولسن", "Kolson Group"],
  ["coca-cola", "Coca-Cola", "کوکا کولا", "Coca-Cola Icecek Pakistan"],
  ["pepsi", "Pepsi", "پیپسی", "PepsiCo Pakistan"],
  ["7up", "7Up", "سیون اپ", "PepsiCo Pakistan"],
  ["shezan", "Shezan", "شیزان", "Shezan International"],
  ["aquafina", "Aquafina", "ایکوافینا", "PepsiCo Pakistan"],
  ["surf-excel", "Surf Excel", "سرف ایکسل", "Unilever Pakistan"],
  ["ariel", "Ariel", "ایریل", "Procter & Gamble Pakistan"],
  ["bonus", "Bonus", "بونس", "Colgate-Palmolive Pakistan"],
  ["brite", "Brite", "برائٹ", "Colgate-Palmolive Pakistan"],
  ["lux", "Lux", "لکس", "Unilever Pakistan"],
  ["lifebuoy", "Lifebuoy", "لائف بوائے", "Unilever Pakistan"],
  ["safeguard", "Safeguard", "سیف گارڈ", "Procter & Gamble Pakistan"],
  ["dettol", "Dettol", "ڈیٹول", "Reckitt Pakistan"],
  ["colgate", "Colgate", "کولگیٹ", "Colgate-Palmolive Pakistan"],
  ["close-up", "Close-Up", "کلوز اپ", "Unilever Pakistan"],
  ["medicam", "Medicam", "میڈیکیم", "Medicam Group"],
  ["sensodyne", "Sensodyne", "سینسوڈائن", "Haleon Pakistan"],
] as const;

type BrandKey = (typeof brandDefs)[number][0];
export const brandId = (key: BrandKey): string => seedId(`brand:${key}`);

export const brands: SeedRow<"brands">[] = brandDefs.map(
  ([slug, name, nameUr, manufacturer], index) => ({
    id: brandId(slug),
    name,
    name_ur: nameUr,
    slug,
    manufacturer,
    logo_path: null,
    is_active: true,
    sort_order: index + 1,
  }),
);

// ------------------------------------------------------------------------------------------------
// Products
// ------------------------------------------------------------------------------------------------

interface ProductDef {
  key: string;
  category: CategoryKey;
  brand: BrandKey | null;
  name: string;
  nameUr: string;
  sku: string;
  packSize: string;
  netQuantity: number;
  netUnit: MeasureUnit;
  /** Pieces per carton (case / peti / bale). */
  carton: number;
  /** Optional middle pack: a dozen or an inner box. */
  inner?: { kind: "dozen" | "inner"; qty: number };
  /** MRP per piece, rupees. */
  mrp: number;
  /** Distributor trade price per piece, rupees (editable). */
  trade: number;
  /** Minimum order in pieces (defaults to 1). */
  moq?: number;
}

const productDefs: ProductDef[] = [
  // Tea & Coffee
  {
    key: "tapal-danedar-950g",
    category: "tea-coffee",
    brand: "tapal",
    name: "Tapal Danedar Black Tea",
    nameUr: "ٹپال دانے دار چائے",
    sku: "TEA-TPL-DAN-950G",
    packSize: "950 g",
    netQuantity: 950,
    netUnit: "g",
    carton: 12,
    mrp: 2050,
    trade: 1860,
  },
  {
    key: "lipton-yellow-label-950g",
    category: "tea-coffee",
    brand: "lipton",
    name: "Lipton Yellow Label Tea",
    nameUr: "لپٹن ییلو لیبل چائے",
    sku: "TEA-LPT-YLL-950G",
    packSize: "950 g",
    netQuantity: 950,
    netUnit: "g",
    carton: 12,
    mrp: 2150,
    trade: 1950,
  },
  {
    key: "tapal-family-mixture-950g",
    category: "tea-coffee",
    brand: "tapal",
    name: "Tapal Family Mixture Tea",
    nameUr: "ٹپال فیملی مکسچر چائے",
    sku: "TEA-TPL-FAM-950G",
    packSize: "950 g",
    netQuantity: 950,
    netUnit: "g",
    carton: 12,
    mrp: 1950,
    trade: 1770,
  },
  {
    key: "nescafe-classic-50g",
    category: "tea-coffee",
    brand: "nestle",
    name: "Nescafé Classic Instant Coffee Jar",
    nameUr: "نیسکیفے کلاسک کافی",
    sku: "COF-NES-CLS-50G",
    packSize: "50 g",
    netQuantity: 50,
    netUnit: "g",
    carton: 24,
    mrp: 1250,
    trade: 1120,
  },
  // Dairy
  {
    key: "milkpak-1l",
    category: "dairy",
    brand: "nestle",
    name: "Nestlé Milkpak UHT Milk",
    nameUr: "نیسلے ملک پیک دودھ",
    sku: "DRY-NES-MPK-1L",
    packSize: "1 L",
    netQuantity: 1,
    netUnit: "l",
    carton: 12,
    mrp: 350,
    trade: 328,
  },
  {
    key: "olpers-1l",
    category: "dairy",
    brand: "olpers",
    name: "Olper's Full Cream Milk",
    nameUr: "اولپرز فل کریم دودھ",
    sku: "DRY-OLP-FCM-1L",
    packSize: "1 L",
    netQuantity: 1,
    netUnit: "l",
    carton: 12,
    mrp: 350,
    trade: 328,
  },
  {
    key: "haleeb-1l",
    category: "dairy",
    brand: "haleeb",
    name: "Haleeb Full Cream Milk",
    nameUr: "حلیب فل کریم دودھ",
    sku: "DRY-HLB-FCM-1L",
    packSize: "1 L",
    netQuantity: 1,
    netUnit: "l",
    carton: 12,
    mrp: 330,
    trade: 309,
  },
  {
    key: "milkpak-250ml",
    category: "dairy",
    brand: "nestle",
    name: "Nestlé Milkpak UHT Milk",
    nameUr: "نیسلے ملک پیک دودھ",
    sku: "DRY-NES-MPK-250ML",
    packSize: "250 ml",
    netQuantity: 250,
    netUnit: "ml",
    carton: 27,
    mrp: 100,
    trade: 93,
  },
  // Cooking oil & ghee
  {
    key: "dalda-oil-1l",
    category: "cooking-oil-ghee",
    brand: "dalda",
    name: "Dalda Cooking Oil Pouch",
    nameUr: "ڈالڈا کوکنگ آئل",
    sku: "OIL-DLD-CKO-1L",
    packSize: "1 L",
    netQuantity: 1,
    netUnit: "l",
    carton: 12,
    mrp: 630,
    trade: 590,
  },
  {
    key: "dalda-oil-5l",
    category: "cooking-oil-ghee",
    brand: "dalda",
    name: "Dalda Cooking Oil Bottle",
    nameUr: "ڈالڈا کوکنگ آئل بوتل",
    sku: "OIL-DLD-CKO-5L",
    packSize: "5 L",
    netQuantity: 5,
    netUnit: "l",
    carton: 4,
    mrp: 3100,
    trade: 2920,
  },
  {
    key: "dalda-banaspati-1kg",
    category: "cooking-oil-ghee",
    brand: "dalda",
    name: "Dalda Banaspati Ghee Pouch",
    nameUr: "ڈالڈا بناسپتی گھی",
    sku: "GHE-DLD-BNS-1KG",
    packSize: "1 kg",
    netQuantity: 1,
    netUnit: "kg",
    carton: 12,
    mrp: 600,
    trade: 562,
  },
  {
    key: "habib-oil-1l",
    category: "cooking-oil-ghee",
    brand: "habib",
    name: "Habib Cooking Oil Pouch",
    nameUr: "حبیب کوکنگ آئل",
    sku: "OIL-HBB-CKO-1L",
    packSize: "1 L",
    netQuantity: 1,
    netUnit: "l",
    carton: 12,
    mrp: 620,
    trade: 582,
  },
  // Atta, rice & sugar
  {
    key: "sunridge-atta-5kg",
    category: "atta-rice-sugar",
    brand: "sunridge",
    name: "Sunridge Chakki Atta",
    nameUr: "سن رج چکی آٹا",
    sku: "ATA-SNR-CHK-5KG",
    packSize: "5 kg",
    netQuantity: 5,
    netUnit: "kg",
    carton: 4,
    mrp: 700,
    trade: 655,
  },
  {
    key: "guard-basmati-1kg",
    category: "atta-rice-sugar",
    brand: "guard",
    name: "Guard Super Kernel Basmati Rice",
    nameUr: "گارڈ سپر کرنل باسمتی چاول",
    sku: "RIC-GRD-SKB-1KG",
    packSize: "1 kg",
    netQuantity: 1,
    netUnit: "kg",
    carton: 10,
    mrp: 540,
    trade: 490,
  },
  {
    key: "falak-basmati-1kg",
    category: "atta-rice-sugar",
    brand: "falak",
    name: "Falak Extreme Basmati Rice",
    nameUr: "فلک ایکسٹریم باسمتی چاول",
    sku: "RIC-FLK-EXB-1KG",
    packSize: "1 kg",
    netQuantity: 1,
    netUnit: "kg",
    carton: 10,
    mrp: 560,
    trade: 510,
  },
  {
    key: "sugar-50kg",
    category: "atta-rice-sugar",
    brand: null,
    name: "Refined Sugar (Cheeni) Bag",
    nameUr: "چینی بوری",
    sku: "SUG-GEN-REF-50KG",
    packSize: "50 kg",
    netQuantity: 50,
    netUnit: "kg",
    carton: 1,
    mrp: 8500,
    trade: 7600,
  },
  // Spices & salt
  {
    key: "shan-biryani-50g",
    category: "spices-salt",
    brand: "shan",
    name: "Shan Biryani Masala",
    nameUr: "شان بریانی مصالحہ",
    sku: "SPC-SHN-BRY-50G",
    packSize: "50 g",
    netQuantity: 50,
    netUnit: "g",
    carton: 144,
    inner: { kind: "dozen", qty: 12 },
    mrp: 160,
    trade: 142,
  },
  {
    key: "shan-chicken-karahi-50g",
    category: "spices-salt",
    brand: "shan",
    name: "Shan Chicken Karahi Masala",
    nameUr: "شان چکن کڑاہی مصالحہ",
    sku: "SPC-SHN-CKR-50G",
    packSize: "50 g",
    netQuantity: 50,
    netUnit: "g",
    carton: 144,
    inner: { kind: "dozen", qty: 12 },
    mrp: 160,
    trade: 142,
  },
  {
    key: "national-biryani-50g",
    category: "spices-salt",
    brand: "national",
    name: "National Biryani Masala",
    nameUr: "نیشنل بریانی مصالحہ",
    sku: "SPC-NTL-BRY-50G",
    packSize: "50 g",
    netQuantity: 50,
    netUnit: "g",
    carton: 144,
    inner: { kind: "dozen", qty: 12 },
    mrp: 150,
    trade: 133,
  },
  {
    key: "national-salt-800g",
    category: "spices-salt",
    brand: "national",
    name: "National Iodized Salt",
    nameUr: "نیشنل آیوڈین ملا نمک",
    sku: "SLT-NTL-IOD-800G",
    packSize: "800 g",
    netQuantity: 800,
    netUnit: "g",
    carton: 24,
    mrp: 65,
    trade: 57,
  },
  {
    key: "himalayan-chef-pink-salt-800g",
    category: "spices-salt",
    brand: "himalayan-chef",
    name: "Himalayan Chef Pink Salt Fine",
    nameUr: "ہمالین شیف گلابی نمک",
    sku: "SLT-HMC-PNK-800G",
    packSize: "800 g",
    netQuantity: 800,
    netUnit: "g",
    carton: 24,
    mrp: 220,
    trade: 190,
  },
  // Noodles & sauces
  {
    key: "knorr-chicken-noodles-66g",
    category: "noodles-sauces",
    brand: "knorr",
    name: "Knorr Chicken Noodles",
    nameUr: "نور چکن نوڈلز",
    sku: "NDL-KNR-CHK-66G",
    packSize: "66 g",
    netQuantity: 66,
    netUnit: "g",
    carton: 72,
    inner: { kind: "dozen", qty: 12 },
    mrp: 80,
    trade: 71,
  },
  {
    key: "knorr-chatt-patta-noodles-66g",
    category: "noodles-sauces",
    brand: "knorr",
    name: "Knorr Chatt Patta Noodles",
    nameUr: "نور چٹ پٹا نوڈلز",
    sku: "NDL-KNR-CHP-66G",
    packSize: "66 g",
    netQuantity: 66,
    netUnit: "g",
    carton: 72,
    inner: { kind: "dozen", qty: 12 },
    mrp: 80,
    trade: 71,
  },
  {
    key: "national-ketchup-800g",
    category: "noodles-sauces",
    brand: "national",
    name: "National Tomato Ketchup",
    nameUr: "نیشنل ٹماٹو کیچپ",
    sku: "SAU-NTL-KET-800G",
    packSize: "800 g",
    netQuantity: 800,
    netUnit: "g",
    carton: 12,
    mrp: 520,
    trade: 465,
  },
  {
    key: "shangrila-ketchup-800g",
    category: "noodles-sauces",
    brand: "shangrila",
    name: "Shangrila Tomato Ketchup",
    nameUr: "شنگریلا ٹماٹو کیچپ",
    sku: "SAU-SHG-KET-800G",
    packSize: "800 g",
    netQuantity: 800,
    netUnit: "g",
    carton: 12,
    mrp: 480,
    trade: 430,
  },
  // Biscuits
  {
    key: "sooper-half-roll",
    category: "biscuits",
    brand: "peek-freans",
    name: "Peek Freans Sooper Biscuit Half Roll",
    nameUr: "پیک فریانز سوپر بسکٹ ہاف رول",
    sku: "BIS-PFR-SPR-HR",
    packSize: "126 g",
    netQuantity: 126,
    netUnit: "g",
    carton: 48,
    inner: { kind: "dozen", qty: 12 },
    mrp: 100,
    trade: 89,
  },
  {
    key: "gluco-half-roll",
    category: "biscuits",
    brand: "peek-freans",
    name: "Peek Freans Gluco Biscuit Half Roll",
    nameUr: "پیک فریانز گلوکو بسکٹ ہاف رول",
    sku: "BIS-PFR-GLC-HR",
    packSize: "75 g",
    netQuantity: 75,
    netUnit: "g",
    carton: 48,
    inner: { kind: "dozen", qty: 12 },
    mrp: 60,
    trade: 53,
  },
  {
    key: "prince-half-roll",
    category: "biscuits",
    brand: "lu",
    name: "LU Prince Chocolate Biscuit Half Roll",
    nameUr: "ایل یو پرنس چاکلیٹ بسکٹ ہاف رول",
    sku: "BIS-LU-PRC-HR",
    packSize: "114 g",
    netQuantity: 114,
    netUnit: "g",
    carton: 48,
    inner: { kind: "dozen", qty: 12 },
    mrp: 100,
    trade: 89,
  },
  {
    key: "candi-half-roll",
    category: "biscuits",
    brand: "lu",
    name: "LU Candi Biscuit Half Roll",
    nameUr: "ایل یو کینڈی بسکٹ ہاف رول",
    sku: "BIS-LU-CND-HR",
    packSize: "104 g",
    netQuantity: 104,
    netUnit: "g",
    carton: 48,
    inner: { kind: "dozen", qty: 12 },
    mrp: 90,
    trade: 80,
  },
  // Snacks
  {
    key: "lays-salted-40g",
    category: "snacks",
    brand: "lays",
    name: "Lay's Classic Salted Chips",
    nameUr: "لیز کلاسک سالٹڈ چپس",
    sku: "SNK-LYS-SLT-40G",
    packSize: "40 g",
    netQuantity: 40,
    netUnit: "g",
    carton: 48,
    inner: { kind: "dozen", qty: 12 },
    mrp: 80,
    trade: 70,
  },
  {
    key: "lays-french-cheese-40g",
    category: "snacks",
    brand: "lays",
    name: "Lay's French Cheese Chips",
    nameUr: "لیز فرنچ چیز چپس",
    sku: "SNK-LYS-FCH-40G",
    packSize: "40 g",
    netQuantity: 40,
    netUnit: "g",
    carton: 48,
    inner: { kind: "dozen", qty: 12 },
    mrp: 80,
    trade: 70,
  },
  {
    key: "kurkure-chutney-chaska-55g",
    category: "snacks",
    brand: "kurkure",
    name: "Kurkure Chutney Chaska",
    nameUr: "کرکرے چٹنی چسکا",
    sku: "SNK-KRK-CHC-55G",
    packSize: "55 g",
    netQuantity: 55,
    netUnit: "g",
    carton: 48,
    inner: { kind: "dozen", qty: 12 },
    mrp: 70,
    trade: 61,
  },
  {
    key: "slanty-vegetable-20g",
    category: "snacks",
    brand: "kolson",
    name: "Kolson Slanty Vegetable Crackers",
    nameUr: "کولسن سلینٹی",
    sku: "SNK-KLS-SLV-20G",
    packSize: "20 g",
    netQuantity: 20,
    netUnit: "g",
    carton: 48,
    inner: { kind: "dozen", qty: 12 },
    mrp: 40,
    trade: 35,
  },
  // Beverages
  {
    key: "coca-cola-1500ml",
    category: "beverages",
    brand: "coca-cola",
    name: "Coca-Cola",
    nameUr: "کوکا کولا",
    sku: "BEV-CCL-REG-1500ML",
    packSize: "1.5 L",
    netQuantity: 1.5,
    netUnit: "l",
    carton: 6,
    mrp: 220,
    trade: 196,
    moq: 6,
  },
  {
    key: "pepsi-1500ml",
    category: "beverages",
    brand: "pepsi",
    name: "Pepsi",
    nameUr: "پیپسی",
    sku: "BEV-PEP-REG-1500ML",
    packSize: "1.5 L",
    netQuantity: 1.5,
    netUnit: "l",
    carton: 6,
    mrp: 220,
    trade: 196,
    moq: 6,
  },
  {
    key: "7up-1500ml",
    category: "beverages",
    brand: "7up",
    name: "7Up",
    nameUr: "سیون اپ",
    sku: "BEV-7UP-REG-1500ML",
    packSize: "1.5 L",
    netQuantity: 1.5,
    netUnit: "l",
    carton: 6,
    mrp: 220,
    trade: 196,
    moq: 6,
  },
  {
    key: "shezan-mango-250ml",
    category: "beverages",
    brand: "shezan",
    name: "Shezan Mango Juice",
    nameUr: "شیزان مینگو جوس",
    sku: "BEV-SHZ-MNG-250ML",
    packSize: "250 ml",
    netQuantity: 250,
    netUnit: "ml",
    carton: 24,
    mrp: 70,
    trade: 61,
    moq: 24,
  },
  // Water
  {
    key: "pure-life-1500ml",
    category: "water",
    brand: "nestle",
    name: "Nestlé Pure Life Water",
    nameUr: "نیسلے پیور لائف پانی",
    sku: "WTR-NES-PRL-1500ML",
    packSize: "1.5 L",
    netQuantity: 1.5,
    netUnit: "l",
    carton: 6,
    mrp: 120,
    trade: 104,
    moq: 6,
  },
  {
    key: "aquafina-1500ml",
    category: "water",
    brand: "aquafina",
    name: "Aquafina Water",
    nameUr: "ایکوافینا پانی",
    sku: "WTR-AQF-REG-1500ML",
    packSize: "1.5 L",
    netQuantity: 1.5,
    netUnit: "l",
    carton: 6,
    mrp: 120,
    trade: 104,
    moq: 6,
  },
  {
    key: "pure-life-500ml",
    category: "water",
    brand: "nestle",
    name: "Nestlé Pure Life Water",
    nameUr: "نیسلے پیور لائف پانی",
    sku: "WTR-NES-PRL-500ML",
    packSize: "500 ml",
    netQuantity: 500,
    netUnit: "ml",
    carton: 12,
    mrp: 70,
    trade: 60,
    moq: 12,
  },
  {
    key: "aquafina-500ml",
    category: "water",
    brand: "aquafina",
    name: "Aquafina Water",
    nameUr: "ایکوافینا پانی",
    sku: "WTR-AQF-REG-500ML",
    packSize: "500 ml",
    netQuantity: 500,
    netUnit: "ml",
    carton: 12,
    mrp: 70,
    trade: 60,
    moq: 12,
  },
  // Detergents
  {
    key: "surf-excel-1kg",
    category: "detergents",
    brand: "surf-excel",
    name: "Surf Excel Washing Powder",
    nameUr: "سرف ایکسل واشنگ پاؤڈر",
    sku: "DET-SRF-EXL-1KG",
    packSize: "1 kg",
    netQuantity: 1,
    netUnit: "kg",
    carton: 12,
    mrp: 1050,
    trade: 950,
  },
  {
    key: "ariel-1kg",
    category: "detergents",
    brand: "ariel",
    name: "Ariel Washing Powder",
    nameUr: "ایریل واشنگ پاؤڈر",
    sku: "DET-ARL-REG-1KG",
    packSize: "1 kg",
    netQuantity: 1,
    netUnit: "kg",
    carton: 12,
    mrp: 1100,
    trade: 995,
  },
  {
    key: "bonus-tristar-1kg",
    category: "detergents",
    brand: "bonus",
    name: "Bonus Tristar Washing Powder",
    nameUr: "بونس ٹرائی اسٹار واشنگ پاؤڈر",
    sku: "DET-BNS-TRS-1KG",
    packSize: "1 kg",
    netQuantity: 1,
    netUnit: "kg",
    carton: 12,
    mrp: 480,
    trade: 430,
  },
  {
    key: "brite-1kg",
    category: "detergents",
    brand: "brite",
    name: "Brite Maximum Power Washing Powder",
    nameUr: "برائٹ میکسیمم پاور واشنگ پاؤڈر",
    sku: "DET-BRT-MXP-1KG",
    packSize: "1 kg",
    netQuantity: 1,
    netUnit: "kg",
    carton: 12,
    mrp: 700,
    trade: 630,
  },
  // Soaps
  {
    key: "lux-soft-touch-128g",
    category: "soaps",
    brand: "lux",
    name: "Lux Soft Touch Soap",
    nameUr: "لکس سوفٹ ٹچ صابن",
    sku: "SOP-LUX-SFT-128G",
    packSize: "128 g",
    netQuantity: 128,
    netUnit: "g",
    carton: 72,
    inner: { kind: "dozen", qty: 12 },
    mrp: 185,
    trade: 165,
  },
  {
    key: "lifebuoy-total-128g",
    category: "soaps",
    brand: "lifebuoy",
    name: "Lifebuoy Total 10 Soap",
    nameUr: "لائف بوائے ٹوٹل صابن",
    sku: "SOP-LFB-TOT-128G",
    packSize: "128 g",
    netQuantity: 128,
    netUnit: "g",
    carton: 72,
    inner: { kind: "dozen", qty: 12 },
    mrp: 170,
    trade: 152,
  },
  {
    key: "safeguard-pure-white-103g",
    category: "soaps",
    brand: "safeguard",
    name: "Safeguard Pure White Soap",
    nameUr: "سیف گارڈ پیور وائٹ صابن",
    sku: "SOP-SFG-PRW-103G",
    packSize: "103 g",
    netQuantity: 103,
    netUnit: "g",
    carton: 72,
    inner: { kind: "dozen", qty: 12 },
    mrp: 175,
    trade: 156,
  },
  {
    key: "dettol-original-110g",
    category: "soaps",
    brand: "dettol",
    name: "Dettol Original Soap",
    nameUr: "ڈیٹول اوریجنل صابن",
    sku: "SOP-DTL-ORG-110G",
    packSize: "110 g",
    netQuantity: 110,
    netUnit: "g",
    carton: 72,
    inner: { kind: "dozen", qty: 12 },
    mrp: 190,
    trade: 170,
  },
  // Oral care
  {
    key: "colgate-mcp-140g",
    category: "oral-care",
    brand: "colgate",
    name: "Colgate Maximum Cavity Protection Toothpaste",
    nameUr: "کولگیٹ ٹوتھ پیسٹ",
    sku: "ORL-CLG-MCP-140G",
    packSize: "140 g",
    netQuantity: 140,
    netUnit: "g",
    carton: 72,
    inner: { kind: "dozen", qty: 12 },
    mrp: 420,
    trade: 375,
  },
  {
    key: "close-up-red-hot-140g",
    category: "oral-care",
    brand: "close-up",
    name: "Close-Up Red Hot Toothpaste",
    nameUr: "کلوز اپ ریڈ ہاٹ ٹوتھ پیسٹ",
    sku: "ORL-CLU-RDH-140G",
    packSize: "140 g",
    netQuantity: 140,
    netUnit: "g",
    carton: 72,
    inner: { kind: "dozen", qty: 12 },
    mrp: 400,
    trade: 357,
  },
  {
    key: "medicam-150g",
    category: "oral-care",
    brand: "medicam",
    name: "Medicam Dental Cream",
    nameUr: "میڈیکیم ڈینٹل کریم",
    sku: "ORL-MDC-DNC-150G",
    packSize: "150 g",
    netQuantity: 150,
    netUnit: "g",
    carton: 72,
    inner: { kind: "dozen", qty: 12 },
    mrp: 300,
    trade: 268,
  },
  {
    key: "sensodyne-fresh-mint-70g",
    category: "oral-care",
    brand: "sensodyne",
    name: "Sensodyne Fresh Mint Toothpaste",
    nameUr: "سینسوڈائن فریش منٹ ٹوتھ پیسٹ",
    sku: "ORL-SND-FRM-70G",
    packSize: "70 g",
    netQuantity: 70,
    netUnit: "g",
    carton: 48,
    inner: { kind: "dozen", qty: 12 },
    mrp: 700,
    trade: 625,
  },
];

type ProductKey = (typeof productDefs)[number]["key"];

export const masterProductId = (key: ProductKey): string => seedId(`master-product:${key}`);
const distributorProductId = (key: ProductKey): string =>
  seedId(`distributor-product:indus-traders:${key}`);

const productBarcode = (def: ProductDef): string => {
  const categoryIndex = categoryDefs.findIndex(([slug]) => slug === def.category) + 1;
  const productIndex = productDefs.filter((p) => p.category === def.category).indexOf(def) + 1;
  return ean13(
    `2001${String(categoryIndex).padStart(2, "0")}${String(productIndex).padStart(2, "0")}0000`,
  );
};

const findProduct = (key: string): ProductDef => {
  const def = productDefs.find((p) => p.key === key);
  if (!def) throw new Error(`Unknown seed product ${key}`);
  return def;
};

export const masterProducts: SeedRow<"master_products">[] = productDefs.map((def) => ({
  id: masterProductId(def.key),
  name: def.name,
  name_ur: def.nameUr,
  brand_id: def.brand ? brandId(def.brand) : null,
  category_id: categoryId(def.category),
  barcode: productBarcode(def),
  sku: def.sku,
  pack_size_label: def.packSize,
  net_quantity: def.netQuantity,
  net_unit: def.netUnit,
  units_per_carton: def.carton,
  mrp_paisa: rs(def.mrp),
  description: null,
  image_path: null,
  is_active: true,
}));

// Search / voice lexicon: Roman Urdu, Urdu script and common mishearings.
type AliasLanguage = AppLocale;
type AliasKind = Database["public"]["Enums"]["alias_kind"];
type AliasTarget = { brand: BrandKey } | { category: CategoryKey } | { product: ProductKey };

const aliasDefs: [AliasTarget, string, AliasLanguage, AliasKind][] = [
  // Brands
  [{ brand: "tapal" }, "Tapal", "en", "name"],
  [{ brand: "tapal" }, "taapal", "ur-Latn", "spelling"],
  [{ brand: "tapal" }, "tapaal", "ur-Latn", "spelling"],
  [{ brand: "tapal" }, "ٹپال", "ur", "name"],
  [{ brand: "tapal" }, "table chai", "ur-Latn", "mishearing"],
  [{ brand: "lipton" }, "liptan", "ur-Latn", "spelling"],
  [{ brand: "lipton" }, "لپٹن", "ur", "name"],
  [{ brand: "nestle" }, "nesley", "ur-Latn", "spelling"],
  [{ brand: "nestle" }, "نیسلے", "ur", "name"],
  [{ brand: "olpers" }, "olpers", "en", "spelling"],
  [{ brand: "olpers" }, "olpars", "ur-Latn", "spelling"],
  [{ brand: "olpers" }, "alpers", "ur-Latn", "mishearing"],
  [{ brand: "olpers" }, "اولپرز", "ur", "name"],
  [{ brand: "haleeb" }, "حلیب", "ur", "name"],
  [{ brand: "dalda" }, "dalada", "ur-Latn", "spelling"],
  [{ brand: "dalda" }, "ڈالڈا", "ur", "name"],
  [{ brand: "habib" }, "habeeb", "ur-Latn", "spelling"],
  [{ brand: "habib" }, "حبیب", "ur", "name"],
  [{ brand: "shan" }, "شان", "ur", "name"],
  [{ brand: "national" }, "nashnal", "ur-Latn", "spelling"],
  [{ brand: "national" }, "نیشنل", "ur", "name"],
  [{ brand: "knorr" }, "nor", "ur-Latn", "spelling"],
  [{ brand: "knorr" }, "noor noodles", "ur-Latn", "mishearing"],
  [{ brand: "knorr" }, "نور", "ur", "name"],
  [{ brand: "peek-freans" }, "pik frens", "ur-Latn", "spelling"],
  [{ brand: "peek-freans" }, "پیک فریانز", "ur", "name"],
  [{ brand: "lays" }, "lays", "en", "spelling"],
  [{ brand: "lays" }, "lez", "ur-Latn", "spelling"],
  [{ brand: "lays" }, "لیز", "ur", "name"],
  [{ brand: "kurkure" }, "kurkuray", "ur-Latn", "spelling"],
  [{ brand: "kurkure" }, "کرکرے", "ur", "name"],
  [{ brand: "coca-cola" }, "coke", "en", "name"],
  [{ brand: "coca-cola" }, "کوک", "ur", "name"],
  [{ brand: "pepsi" }, "پیپسی", "ur", "name"],
  [{ brand: "7up" }, "seven up", "en", "spelling"],
  [{ brand: "aquafina" }, "akwafina", "ur-Latn", "spelling"],
  [{ brand: "surf-excel" }, "surf", "en", "name"],
  [{ brand: "surf-excel" }, "sarf", "ur-Latn", "spelling"],
  [{ brand: "surf-excel" }, "سرف", "ur", "name"],
  [{ brand: "ariel" }, "aerial", "ur-Latn", "mishearing"],
  [{ brand: "ariel" }, "ایریل", "ur", "name"],
  [{ brand: "lux" }, "laks", "ur-Latn", "spelling"],
  [{ brand: "lux" }, "لکس", "ur", "name"],
  [{ brand: "lifebuoy" }, "lifeboy", "ur-Latn", "spelling"],
  [{ brand: "lifebuoy" }, "لائف بوائے", "ur", "name"],
  [{ brand: "safeguard" }, "safe guard", "en", "spelling"],
  [{ brand: "colgate" }, "kolgate", "ur-Latn", "spelling"],
  [{ brand: "colgate" }, "کولگیٹ", "ur", "name"],
  // Products
  [{ product: "tapal-danedar-950g" }, "danedar", "ur-Latn", "name"],
  [{ product: "tapal-danedar-950g" }, "dane dar", "ur-Latn", "spelling"],
  [{ product: "tapal-danedar-950g" }, "دانے دار", "ur", "name"],
  [{ product: "milkpak-1l" }, "milk pak", "ur-Latn", "spelling"],
  [{ product: "milkpak-1l" }, "milk pack", "ur-Latn", "mishearing"],
  [{ product: "milkpak-1l" }, "ملک پیک", "ur", "name"],
  [{ product: "sooper-half-roll" }, "super biscuit", "ur-Latn", "spelling"],
  [{ product: "sooper-half-roll" }, "سوپر", "ur", "name"],
  [{ product: "prince-half-roll" }, "پرنس", "ur", "name"],
  [{ product: "sugar-50kg" }, "cheeni bori", "ur-Latn", "name"],
  // Categories (generic words)
  [{ category: "tea-coffee" }, "chai", "ur-Latn", "generic"],
  [{ category: "tea-coffee" }, "chaye", "ur-Latn", "generic"],
  [{ category: "tea-coffee" }, "patti", "ur-Latn", "generic"],
  [{ category: "tea-coffee" }, "چائے", "ur", "generic"],
  [{ category: "tea-coffee" }, "پتی", "ur", "generic"],
  [{ category: "dairy" }, "doodh", "ur-Latn", "generic"],
  [{ category: "dairy" }, "dudh", "ur-Latn", "spelling"],
  [{ category: "dairy" }, "دودھ", "ur", "generic"],
  [{ category: "cooking-oil-ghee" }, "ghee", "ur-Latn", "generic"],
  [{ category: "cooking-oil-ghee" }, "گھی", "ur", "generic"],
  [{ category: "cooking-oil-ghee" }, "tel", "ur-Latn", "generic"],
  [{ category: "cooking-oil-ghee" }, "تیل", "ur", "generic"],
  [{ category: "cooking-oil-ghee" }, "banaspati", "ur-Latn", "generic"],
  [{ category: "atta-rice-sugar" }, "atta", "ur-Latn", "generic"],
  [{ category: "atta-rice-sugar" }, "aata", "ur-Latn", "spelling"],
  [{ category: "atta-rice-sugar" }, "آٹا", "ur", "generic"],
  [{ category: "atta-rice-sugar" }, "chawal", "ur-Latn", "generic"],
  [{ category: "atta-rice-sugar" }, "چاول", "ur", "generic"],
  [{ category: "atta-rice-sugar" }, "cheeni", "ur-Latn", "generic"],
  [{ category: "atta-rice-sugar" }, "chini", "ur-Latn", "spelling"],
  [{ category: "atta-rice-sugar" }, "چینی", "ur", "generic"],
  [{ category: "atta-rice-sugar" }, "shakkar", "ur-Latn", "generic"],
  [{ category: "spices-salt" }, "masala", "ur-Latn", "generic"],
  [{ category: "spices-salt" }, "مصالحہ", "ur", "generic"],
  [{ category: "spices-salt" }, "namak", "ur-Latn", "generic"],
  [{ category: "spices-salt" }, "نمک", "ur", "generic"],
  [{ category: "noodles-sauces" }, "noodles", "en", "generic"],
  [{ category: "noodles-sauces" }, "نوڈلز", "ur", "generic"],
  [{ category: "noodles-sauces" }, "ketchup", "en", "generic"],
  [{ category: "noodles-sauces" }, "کیچپ", "ur", "generic"],
  [{ category: "noodles-sauces" }, "chutni", "ur-Latn", "generic"],
  [{ category: "biscuits" }, "biskut", "ur-Latn", "spelling"],
  [{ category: "biscuits" }, "بسکٹ", "ur", "generic"],
  [{ category: "snacks" }, "chips", "en", "generic"],
  [{ category: "snacks" }, "چپس", "ur", "generic"],
  [{ category: "snacks" }, "namkeen", "ur-Latn", "generic"],
  [{ category: "beverages" }, "cold drink", "ur-Latn", "generic"],
  [{ category: "beverages" }, "botal", "ur-Latn", "generic"],
  [{ category: "beverages" }, "کولڈ ڈرنک", "ur", "generic"],
  [{ category: "beverages" }, "juice", "en", "generic"],
  [{ category: "water" }, "pani", "ur-Latn", "generic"],
  [{ category: "water" }, "پانی", "ur", "generic"],
  [{ category: "water" }, "mineral water", "en", "generic"],
  [{ category: "detergents" }, "washing powder", "en", "generic"],
  [{ category: "detergents" }, "kapray dhone ka powder", "ur-Latn", "generic"],
  [{ category: "soaps" }, "sabun", "ur-Latn", "generic"],
  [{ category: "soaps" }, "صابن", "ur", "generic"],
  [{ category: "oral-care" }, "toothpaste", "en", "generic"],
  [{ category: "oral-care" }, "manjan", "ur-Latn", "generic"],
  [{ category: "oral-care" }, "منجن", "ur", "generic"],
];

export const productAliases: SeedRow<"product_aliases">[] = aliasDefs.map(
  ([target, alias, language, kind]) => {
    const base = { alias, language, kind, weight: kind === "mishearing" ? 0.8 : 1 };
    if ("brand" in target) {
      return {
        ...base,
        id: seedId(`alias:brand:${target.brand}:${alias}`),
        target_type: "brand",
        brand_id: brandId(target.brand),
        master_product_id: null,
        category_id: null,
      };
    }
    if ("category" in target) {
      return {
        ...base,
        id: seedId(`alias:category:${target.category}:${alias}`),
        target_type: "category",
        category_id: categoryId(target.category),
        master_product_id: null,
        brand_id: null,
      };
    }
    return {
      ...base,
      id: seedId(`alias:product:${target.product}:${alias}`),
      target_type: "product",
      master_product_id: masterProductId(target.product),
      brand_id: null,
      category_id: null,
    };
  },
);

export const featureFlags: SeedRow<"feature_flags">[] = [
  {
    id: seedId("flag:sindhi_ui"),
    key: "sindhi_ui",
    description: "Show Sindhi in the language picker (hidden until translations are reviewed).",
    enabled: false,
    rules: {},
  },
];

// ------------------------------------------------------------------------------------------------
// Distributor: Indus Traders
// ------------------------------------------------------------------------------------------------

export const ORG_ID = seedId("org:indus-traders");
const WAREHOUSE_ID = seedId("warehouse:indus-traders:main");

export const organizations: SeedRow<"organizations">[] = [
  {
    id: ORG_ID,
    name: "Indus Traders",
    slug: "indus-traders",
    legal_name: "Indus Traders",
    description:
      "FMCG distributor for tea, dairy, edible oil, snacks, beverages and home care across Hyderabad.",
    phone: "+922238001122",
    email: "orders@industraders.example.pk",
    ntn: "1234567-8",
    strn: "17-00-1234-567-89",
    address_line: "Shop 5-6, Al-Rehman Plaza, Main Road, Latifabad Unit 2, Hyderabad",
    area_id: areaId("latifabad-unit-2"),
    lat: 25.3838,
    lng: 68.3846,
    served_area_ids: null,
    logo_path: null,
    cover_path: null,
    status: "approved",
    submitted_at: "2026-09-01T05:00:00Z",
    approved_at: "2026-09-02T06:30:00Z",
    min_order_paisa: rs(3000),
    delivery_fee_paisa: 0,
    free_delivery_above_paisa: null,
    settings: {
      order_cutoff_time: "18:00",
      delivery_days: [1, 2, 3, 4, 5, 6],
      default_credit_limit_paisa: rs(50000),
      default_payment_terms_days: 7,
      overdue_hold_days: 30,
      enforce_stock: false,
    },
  },
];

export const warehouses: SeedRow<"warehouses">[] = [
  {
    id: WAREHOUSE_ID,
    org_id: ORG_ID,
    name: "Main warehouse",
    code: "MAIN",
    address_line: "Godown 3, behind Al-Rehman Plaza, Latifabad Unit 2, Hyderabad",
    area_id: areaId("latifabad-unit-2"),
    lat: 25.3842,
    lng: 68.3851,
    is_default: true,
    is_active: true,
  },
];

export const vehicles: SeedRow<"vehicles">[] = [
  {
    id: seedId("vehicle:indus-traders:bike"),
    org_id: ORG_ID,
    kind: "bike",
    registration_no: "HDA-4521",
    capacity_kg: 120,
    is_active: true,
    notes: "Honda CD 70 for small drops",
  },
  {
    id: seedId("vehicle:indus-traders:loader"),
    org_id: ORG_ID,
    kind: "loader",
    registration_no: "HDQ-0118",
    capacity_kg: 600,
    is_active: true,
    notes: "Loader rickshaw for carton deliveries",
  },
];

export const distributorProducts: SeedRow<"distributor_products">[] = productDefs.map((def) => ({
  id: distributorProductId(def.key),
  org_id: ORG_ID,
  master_product_id: masterProductId(def.key),
  name: `${def.name} ${def.packSize}`,
  name_ur: def.nameUr,
  sku: def.sku,
  barcode: productBarcode(def),
  brand_id: def.brand ? brandId(def.brand) : null,
  category_id: categoryId(def.category),
  description: null,
  pack_size_label: def.packSize,
  image_path: null,
  mrp_paisa: rs(def.mrp),
  trade_price_paisa: rs(def.trade),
  moq_base_qty: def.moq ?? 1,
  visible_area_ids: null,
  is_active: true,
}));

export const packUnits: SeedRow<"pack_units">[] = productDefs.flatMap((def) => {
  const productId = distributorProductId(def.key);
  const rows: SeedRow<"pack_units">[] = [
    {
      id: seedId(`pack:${def.key}:piece`),
      distributor_product_id: productId,
      org_id: ORG_ID,
      unit: "piece",
      label: "Piece",
      base_qty: 1,
      barcode: null,
      is_default: false,
    },
  ];
  if (def.inner) {
    rows.push({
      id: seedId(`pack:${def.key}:${def.inner.kind}`),
      distributor_product_id: productId,
      org_id: ORG_ID,
      unit: def.inner.kind,
      label: def.inner.kind === "dozen" ? "Dozen (12 pcs)" : `Box (${def.inner.qty} pcs)`,
      base_qty: def.inner.qty,
      barcode: null,
      is_default: true,
    });
  }
  if (def.carton > 1) {
    rows.push({
      id: seedId(`pack:${def.key}:carton`),
      distributor_product_id: productId,
      org_id: ORG_ID,
      unit: "carton",
      label: `Carton (${def.carton} pcs)`,
      base_qty: def.carton,
      barcode: null,
      is_default: !def.inner,
    });
  }
  if (rows.length === 1 && rows[0]) {
    rows[0].is_default = true;
  }
  return rows;
});

const today = new Date();
const plusDays = (days: number): string =>
  new Date(today.getTime() + days * 86_400_000).toISOString();

export const schemes: SeedRow<"schemes">[] = [
  {
    id: seedId("scheme:indus-traders:olpers-12-plus-1"),
    org_id: ORG_ID,
    name: "Olper's 1 L: 12 + 1 free",
    name_ur: "اولپرز 1 لیٹر: 12 کے ساتھ 1 مفت",
    description: "Buy 12 packs of Olper's Full Cream Milk 1 L and get 1 free.",
    kind: "buy_x_get_y",
    rules: { buy_base_qty: 12, free_base_qty: 1 },
    area_ids: null,
    segments: null,
    starts_at: today.toISOString(),
    ends_at: plusDays(60),
    is_active: true,
    priority: 0,
  },
];

export const schemeProducts: SeedRow<"scheme_products">[] = [
  {
    id: seedId("scheme-product:olpers-12-plus-1:trigger"),
    scheme_id: seedId("scheme:indus-traders:olpers-12-plus-1"),
    distributor_product_id: distributorProductId("olpers-1l"),
    org_id: ORG_ID,
    role: "trigger",
  },
];

// ------------------------------------------------------------------------------------------------
// Dukan: TezDukan (live, serves all of Hyderabad)
// ------------------------------------------------------------------------------------------------

export const SHOP_ID = seedId("shop:tezdukan");

export const buildShops = (withDemoUsers: boolean): SeedRow<"shops">[] => [
  {
    id: SHOP_ID,
    owner_id: withDemoUsers ? DEMO_USERS.dukandar.id : null,
    name: "TezDukan",
    slug: "tezdukan",
    // Without demo users there is no owner yet; leave the phone empty so nobody can claim the
    // shop by verifying a number.
    phone: withDemoUsers ? DEMO_USERS.dukandar.phone : null,
    whatsapp: withDemoUsers ? DEMO_USERS.dukandar.phone : null,
    kind: "kirana",
    description:
      "Your neighbourhood kiryana, delivered across Hyderabad. Tea, dairy, oil, atta, snacks and home care at fair prices.",
    address_line: "Shop 12, Main Road, Latifabad Unit 6, Hyderabad",
    area_id: areaId("latifabad-unit-6"),
    lat: 25.3735,
    lng: 68.3875,
    photo_path: null,
    cover_path: null,
    status: "approved",
    tier: "gold",
    submitted_at: "2026-09-05T05:00:00Z",
    approved_at: "2026-09-05T09:00:00Z",
  },
];

const everyDay = [{ open: "08:00", close: "23:00" }];

export const storefrontSettings: SeedRow<"storefront_settings">[] = [
  {
    id: seedId("storefront:tezdukan"),
    shop_id: SHOP_ID,
    is_live: true,
    tagline: "Apni Dukan. Ab Aapke Ghar Tak.",
    about: "Groceries and daily essentials delivered anywhere in Hyderabad.",
    timings: {
      mon: everyDay,
      tue: everyDay,
      wed: everyDay,
      thu: everyDay,
      fri: everyDay,
      sat: everyDay,
      sun: everyDay,
    },
    delivery_radius_m: 15000,
    serves_all_city: true,
    min_order_paisa: rs(300),
    delivery_fee_paisa: rs(50),
    free_delivery_above_paisa: rs(1500),
    eta_minutes: 45,
    payment_options: ["cod", "jazzcash", "easypaisa"],
    pickup_enabled: true,
    accept_orders_when_closed: false,
    announcement: null,
    gallery_paths: [],
  },
];

// Stock on the shelf: [product, quantity, low-stock threshold, selling price (rupees, defaults to MRP), favourite]
const shelf: [ProductKey, number, number, number | null, boolean][] = [
  ["tapal-danedar-950g", 8, 3, null, true],
  ["lipton-yellow-label-950g", 5, 3, null, false],
  ["milkpak-1l", 24, 12, null, true],
  ["olpers-1l", 4, 12, null, false],
  ["dalda-oil-1l", 15, 6, null, true],
  ["dalda-oil-5l", 3, 2, null, false],
  ["habib-oil-1l", 10, 6, null, false],
  ["sunridge-atta-5kg", 9, 4, null, false],
  ["guard-basmati-1kg", 12, 5, 530, false],
  ["shan-biryani-50g", 36, 12, null, true],
  ["national-salt-800g", 20, 10, null, false],
  ["knorr-chicken-noodles-66g", 48, 24, null, true],
  ["national-ketchup-800g", 6, 3, null, false],
  ["sooper-half-roll", 30, 12, null, true],
  ["prince-half-roll", 18, 12, null, false],
  ["lays-salted-40g", 40, 12, null, false],
  ["kurkure-chutney-chaska-55g", 10, 12, null, false],
  ["coca-cola-1500ml", 18, 6, null, true],
  ["pepsi-1500ml", 12, 6, null, false],
  ["pure-life-1500ml", 24, 6, null, false],
  ["surf-excel-1kg", 6, 4, null, false],
  ["bonus-tristar-1kg", 2, 4, null, false],
  ["lux-soft-touch-128g", 24, 12, null, true],
  ["lifebuoy-total-128g", 20, 12, null, false],
  ["colgate-mcp-140g", 10, 6, null, false],
  ["medicam-150g", 8, 6, null, false],
];

const LOOSE_SUGAR_ID = seedId("inventory:tezdukan:loose-sugar");

export const shopInventory: SeedRow<"shop_inventory">[] = [
  ...shelf.map(([key, qty, threshold, selling, favourite]): SeedRow<"shop_inventory"> => {
    const def = findProduct(key);
    return {
      id: seedId(`inventory:tezdukan:${key}`),
      shop_id: SHOP_ID,
      master_product_id: masterProductId(key),
      distributor_product_id: distributorProductId(key),
      name: `${def.name} ${def.packSize}`,
      name_ur: def.nameUr,
      barcode: productBarcode(def),
      sku: def.sku,
      category_id: categoryId(def.category),
      brand_id: def.brand ? brandId(def.brand) : null,
      pack_size_label: def.packSize,
      unit: "pc",
      is_loose: false,
      cost_price_paisa: rs(def.trade),
      selling_price_paisa: rs(selling ?? def.mrp),
      mrp_paisa: rs(def.mrp),
      qty_on_hand: qty,
      low_stock_threshold: threshold,
      is_favourite: favourite,
      is_visible_online: true,
      is_active: true,
      image_path: null,
    };
  }),
  {
    id: LOOSE_SUGAR_ID,
    shop_id: SHOP_ID,
    master_product_id: null,
    distributor_product_id: null,
    name: "Cheeni (Sugar), loose",
    name_ur: "چینی کھلی",
    barcode: null,
    sku: null,
    category_id: categoryId("atta-rice-sugar"),
    brand_id: null,
    pack_size_label: "per kg",
    unit: "kg",
    is_loose: true,
    cost_price_paisa: rs(152),
    selling_price_paisa: rs(170),
    mrp_paisa: null,
    qty_on_hand: 45.5,
    low_stock_threshold: 10,
    is_favourite: true,
    is_visible_online: true,
    is_active: true,
    image_path: null,
  },
];

/** Opening balance movements so stock history matches qty_on_hand. */
export const shopStockMovements: SeedRow<"shop_stock_movements">[] = shopInventory
  .filter((item) => Number(item.qty_on_hand ?? 0) > 0)
  .map((item) => ({
    id: seedId(`movement:opening:${item.id}`),
    shop_id: SHOP_ID,
    inventory_id: item.id,
    movement_type: "opening",
    qty: Number(item.qty_on_hand ?? 0),
    balance_after: Number(item.qty_on_hand ?? 0),
    unit_cost_paisa: item.cost_price_paisa ?? 0,
    reference_type: "seed",
    reference_id: null,
    reason: "Opening stock",
  }));

// ------------------------------------------------------------------------------------------------
// Rows that need the demo users
// ------------------------------------------------------------------------------------------------

const memberId = (user: DemoUser): string => seedId(`org-member:indus-traders:${user.key}`);

export const userRoles: SeedRow<"user_roles">[] = [
  { id: seedId("user-role:admin"), user_id: DEMO_USERS.admin.id, role: "admin" },
];

export const orgMembers: SeedRow<"org_members">[] = [
  {
    id: memberId(DEMO_USERS.distributor),
    org_id: ORG_ID,
    user_id: DEMO_USERS.distributor.id,
    role: "owner",
    permissions: [],
    status: "active",
    display_name: DEMO_USERS.distributor.fullName,
    phone: DEMO_USERS.distributor.phone,
    joined_at: "2026-09-01T05:00:00Z",
  },
  {
    id: memberId(DEMO_USERS.multi),
    org_id: ORG_ID,
    user_id: DEMO_USERS.multi.id,
    role: "manager",
    permissions: [],
    status: "active",
    display_name: DEMO_USERS.multi.fullName,
    phone: DEMO_USERS.multi.phone,
    joined_at: "2026-09-03T05:00:00Z",
  },
  {
    id: memberId(DEMO_USERS.multi2),
    org_id: ORG_ID,
    user_id: DEMO_USERS.multi2.id,
    role: "accountant",
    permissions: [],
    status: "active",
    display_name: DEMO_USERS.multi2.fullName,
    phone: DEMO_USERS.multi2.phone,
    joined_at: "2026-09-04T05:00:00Z",
  },
  {
    id: memberId(DEMO_USERS.booker),
    org_id: ORG_ID,
    user_id: DEMO_USERS.booker.id,
    role: "booker",
    permissions: [],
    status: "active",
    display_name: DEMO_USERS.booker.fullName,
    phone: DEMO_USERS.booker.phone,
    joined_at: "2026-09-03T05:00:00Z",
  },
  {
    id: memberId(DEMO_USERS.rider),
    org_id: ORG_ID,
    user_id: DEMO_USERS.rider.id,
    role: "rider",
    permissions: [],
    status: "active",
    display_name: DEMO_USERS.rider.fullName,
    phone: DEMO_USERS.rider.phone,
    joined_at: "2026-09-03T05:00:00Z",
  },
];

export const riders: SeedRow<"riders">[] = [
  {
    id: seedId("rider:indus-traders:rider"),
    org_id: ORG_ID,
    member_id: memberId(DEMO_USERS.rider),
    vehicle_id: seedId("vehicle:indus-traders:bike"),
    cnic_last4: "4321",
    is_active: true,
  },
];

export const shopStaff: SeedRow<"shop_staff">[] = [
  {
    id: seedId("shop-staff:tezdukan:dukandar"),
    shop_id: SHOP_ID,
    user_id: DEMO_USERS.dukandar.id,
    role: "owner",
    permissions: [],
    status: "active",
    display_name: DEMO_USERS.dukandar.fullName,
    phone: DEMO_USERS.dukandar.phone,
    joined_at: "2026-09-05T05:00:00Z",
  },
  {
    id: seedId("shop-staff:tezdukan:multi"),
    shop_id: SHOP_ID,
    user_id: DEMO_USERS.multi.id,
    role: "cashier",
    permissions: ["billing", "customer_orders"],
    status: "active",
    display_name: DEMO_USERS.multi.fullName,
    phone: DEMO_USERS.multi.phone,
    joined_at: "2026-09-06T05:00:00Z",
  },
  {
    id: seedId("shop-staff:tezdukan:multi2"),
    shop_id: SHOP_ID,
    user_id: DEMO_USERS.multi2.id,
    role: "staff",
    permissions: ["inventory"],
    status: "active",
    display_name: DEMO_USERS.multi2.fullName,
    phone: DEMO_USERS.multi2.phone,
    joined_at: "2026-09-07T05:00:00Z",
  },
];

export const buildRetailerAccounts = (withDemoUsers: boolean): SeedRow<"retailer_accounts">[] => [
  {
    id: seedId("retailer-account:indus-traders:tezdukan"),
    org_id: ORG_ID,
    shop_id: SHOP_ID,
    price_tier_id: null,
    segment: "Key account",
    credit_limit_paisa: rs(250000),
    payment_terms_days: 15,
    status: "active",
    hold_reason: null,
    hold_override_until: null,
    assigned_booker_id: withDemoUsers ? memberId(DEMO_USERS.booker) : null,
    notes: "Orders twice a week. Prefers morning delivery.",
  },
];

export const beats: SeedRow<"beats">[] = [
  {
    id: seedId("beat:indus-traders:monday-latifabad"),
    org_id: ORG_ID,
    booker_id: memberId(DEMO_USERS.booker),
    name: "Latifabad Units 6 to 8",
    weekday: 1,
    area_id: areaId("latifabad-unit-6"),
    is_active: true,
    notes: null,
  },
];

export const beatShops: SeedRow<"beat_shops">[] = [
  {
    id: seedId("beat-shop:monday-latifabad:tezdukan"),
    beat_id: seedId("beat:indus-traders:monday-latifabad"),
    org_id: ORG_ID,
    shop_id: SHOP_ID,
    sequence: 1,
    notes: null,
  },
];

export const addresses: SeedRow<"addresses">[] = [
  {
    id: seedId("address:customer:home"),
    user_id: DEMO_USERS.customer.id,
    label: "Home",
    recipient_name: DEMO_USERS.customer.fullName,
    line1: "House 27, Block C, Qasimabad Phase 1",
    line2: null,
    landmark: "Near Naseem Nagar Chowk",
    area_id: areaId("qasimabad"),
    city: "Hyderabad",
    lat: 25.4012,
    lng: 68.3321,
    phone: DEMO_USERS.customer.phone,
    is_default: true,
  },
];

// ------------------------------------------------------------------------------------------------
// Where each demo user starts, so a demo opens on that role's home instead of the default
// customer view. The multi-role user starts as a customer so the role switcher has a job.
// ------------------------------------------------------------------------------------------------

export const demoStartingContexts: {
  userId: string;
  role: AppRole;
  shopId: string | null;
  orgId: string | null;
}[] = [
  { userId: DEMO_USERS.admin.id, role: "admin", shopId: null, orgId: null },
  { userId: DEMO_USERS.dukandar.id, role: "dukandar", shopId: SHOP_ID, orgId: null },
  { userId: DEMO_USERS.distributor.id, role: "distributor", shopId: null, orgId: ORG_ID },
  { userId: DEMO_USERS.booker.id, role: "booker", shopId: null, orgId: ORG_ID },
  { userId: DEMO_USERS.rider.id, role: "rider", shopId: null, orgId: ORG_ID },
];
