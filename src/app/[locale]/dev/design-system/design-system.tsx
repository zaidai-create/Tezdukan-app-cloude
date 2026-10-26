"use client";

import { cn } from "cn";
import {
  Bell,
  Box,
  ChevronRight,
  ClipboardList,
  CloudOff,
  Mic,
  Moon,
  PackageSearch,
  Receipt,
  Search,
  ShoppingBag,
  Store,
  SunMedium,
  Truck,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Awning } from "@/components/brand/awning";
import { Logo, LogoMark, Wordmark } from "@/components/brand/logo";
import { SpeedLines, SpeedLoader } from "@/components/brand/speed-lines";
import { AddToCart } from "@/components/commerce/add-to-cart";
import { CartBar } from "@/components/commerce/cart-bar";
import { Price } from "@/components/commerce/price";
import { ProductCard, type ProductCardData } from "@/components/commerce/product-card";
import { BottomNav } from "@/components/layout/bottom-nav";
import { mobileTabs } from "@/components/layout/nav-config";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import {
  ListRowSkeleton,
  ProductCardSkeleton,
  StatCardSkeleton,
} from "@/components/states/skeletons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip, ChipRow, FilterChip } from "@/components/ui/chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/lib/theme/use-theme";

const brandTokens = [
  ["--primary", "#0A8F5A", "#2ED3A3", "ADD buttons, active nav, progress"],
  ["--primary-strong", "#07704A", "#5FE3BC", "Filled buttons and green text (AA)"],
  ["--mint", "#2ED3A3", "#2ED3A3", "Brand accents, Munshi, highlights"],
  ["--awning", "#FFB627", "#FFC24D", "Offers, schemes, ratings, awning"],
  ["--awning-deep", "#FF7A1A", "#FF8F3D", "Sale tags, urgent badges"],
  ["--ink", "#0F1A15", "#E8F0EC", "Main text"],
  ["--muted", "#5B6B64", "#93A39C", "Secondary text"],
  ["--canvas", "#F5F8F6", "#0A0F0D", "Page background"],
  ["--surface", "#FFFFFF", "#121A17", "Cards, sheets"],
  ["--border", "#E3EAE6", "#22302A", "Dividers, outlines"],
  ["--danger", "#E5484D", "#FF6369", "Overdue, errors, delete"],
] as const;

const derivedTokens = [
  ["--action", "Filled CTA background"],
  ["--action-hover", "Filled CTA hover"],
  ["--border-strong", "Form-field outline (3:1)"],
  ["--danger-ink", "Red text, destructive fill"],
  ["--awning-ink", "Amber text"],
  ["--primary-soft", "Selected, success status"],
  ["--awning-soft", "Pending status"],
  ["--danger-soft", "Error status"],
  ["--mint-soft", "Munshi surfaces"],
  ["--subtle", "Hover, skeleton base"],
] as const;

const tints = ["green", "amber", "peach", "teal", "sand", "sky"] as const;
const typeScale = [
  ["text-4xl", "36"],
  ["text-3xl", "30"],
  ["text-2xl", "24"],
  ["text-xl", "20"],
  ["text-lg", "18"],
  ["text-base", "16"],
  ["text-sm", "14"],
  ["text-xs", "12"],
] as const;

const sampleProducts: Record<string, ProductCardData> = {
  tea: {
    id: "tea",
    name: "Tapal Danedar Black Tea",
    packSize: "950 g pouch",
    imageUrl: null,
    inStock: true,
    schemeLabel: "12+1 free",
    moqLabel: "Min 1 carton",
    etaLabel: "Kal subah 10 baje tak",
    units: [
      {
        id: "pc",
        label: "Piece",
        baseQty: 1,
        pricePaisa: 172000,
        regularPricePaisa: 179000,
        mrpPaisa: 189000,
      },
      {
        id: "ctn",
        label: "Carton",
        baseQty: 12,
        pricePaisa: 2040000,
        regularPricePaisa: 2148000,
        mrpPaisa: 2268000,
      },
    ],
  },
  milk: {
    id: "milk",
    name: "Nestlé Milkpak UHT Milk",
    packSize: "1 litre",
    imageUrl: null,
    inStock: true,
    moqLabel: "Min 12",
    units: [{ id: "pc", label: "Piece", baseQty: 1, pricePaisa: 33500, mrpPaisa: 36500 }],
  },
  oil: {
    id: "oil",
    name: "Dalda Cooking Oil Bottle",
    packSize: "5 litre",
    imageUrl: null,
    inStock: false,
    units: [{ id: "pc", label: "Piece", baseQty: 1, pricePaisa: 289000, mrpPaisa: 312000 }],
  },
};

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-10">
      <h2 className="font-heading text-2xl font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Swatch({
  name,
  light,
  dark,
  use,
}: {
  name: string;
  light?: string;
  dark?: string;
  use: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <span
        className="size-12 shrink-0 rounded-md border border-border"
        style={{ background: `var(${name})` }}
      />
      <div className="min-w-0 text-sm">
        <p className="font-mono font-semibold text-ink">{name}</p>
        {light ? (
          <p className="num text-xs text-muted">
            {light} / {dark}
          </p>
        ) : null}
        <p className="truncate text-xs text-muted">{use}</p>
      </div>
    </div>
  );
}

function Demo({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const nav = [
  ["brand", "Brand"],
  ["color", "Colour"],
  ["type", "Type"],
  ["shape", "Shape"],
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["status", "Status"],
  ["navigation", "Navigation"],
  ["commerce", "Commerce"],
  ["overlays", "Overlays"],
  ["states", "States"],
] as const;

export function DesignSystem() {
  const { resolved, setPreference } = useTheme();
  const [rtl, setRtl] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({ tea: 0, milk: 2 });
  const [units, setUnits] = useState<Record<string, string>>({ tea: "ctn" });
  const [notified, setNotified] = useState(false);
  const [chips, setChips] = useState<Record<string, boolean>>({ stock: true });
  const [otp, setOtp] = useState("4821");

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-3">
          <Logo markClassName="size-9" />
          <span className="text-sm font-semibold text-muted">Design system</span>
          <nav className="flex flex-1 scrollbar-none gap-1 overflow-x-auto" aria-label="Sections">
            {nav.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-md px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap text-muted hover:bg-subtle hover:text-ink"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRtl((v) => !v)}
              aria-pressed={rtl}
            >
              {rtl ? "RTL" : "LTR"}
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Toggle dark mode"
              onClick={() => setPreference(resolved === "dark" ? "light" : "dark")}
            >
              {resolved === "dark" ? <SunMedium /> : <Moon />}
            </Button>
          </div>
        </div>
      </header>

      <main
        dir={rtl ? "rtl" : "ltr"}
        lang={rtl ? "ur" : undefined}
        className="mx-auto max-w-7xl px-5 pb-24"
      >
        <div className="py-10">
          <h1 className="font-heading text-4xl font-bold text-ink">TezDukan design system</h1>
          <p className="mt-2 max-w-2xl text-base text-muted">
            Every token, component and state used in the app. Toggle dark mode and RTL above; RTL
            mirrors the whole catalogue the way Urdu and Sindhi screens render.
          </p>
        </div>

        <Section
          id="brand"
          title="Brand"
          description="Logo mark, wordmark and the two signature motifs. Use at most one motif per screen."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <Demo label="Logo mark (tile: app icon, headers)">
                <LogoMark className="size-20" />
                <LogoMark className="size-12" />
                <LogoMark className="size-8" />
              </Demo>
              <div className="mt-5">
                <Demo label="Logo mark (bare: black surfaces only)">
                  <span className="rounded-lg bg-brand-panel p-4">
                    <LogoMark variant="bare" className="h-auto w-40" />
                  </span>
                </Demo>
              </div>
              <div className="mt-5">
                <Demo label="Wordmark">
                  <Wordmark className="h-8" />
                  <span className="rounded-md bg-brand-panel px-3 py-2.5">
                    <Wordmark tone="onDark" className="h-8" />
                  </span>
                </Demo>
              </div>
            </Card>
            <Card className="overflow-hidden">
              <Awning />
              <div className="flex flex-col gap-5 p-5">
                <Demo label="Awning edge (storefront headers, onboarding, order success, empty states)">
                  <div className="w-full max-w-sm overflow-hidden rounded-md border border-border">
                    <Awning height={14} stripe={16} />
                    <div className="h-12 bg-surface" />
                  </div>
                </Demo>
                <Demo label="Speed lines (loaders, order placed, Munshi listening)">
                  <SpeedLines className="w-10" />
                  <SpeedLines animated className="w-12" />
                  <SpeedLoader label="Placing your order" />
                </Demo>
              </div>
            </Card>
          </div>
        </Section>

        <Section
          id="color"
          title="Colour"
          description="Brand tokens from the spec, plus derived tokens that keep every text pairing at WCAG AA. Components never use raw colours."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {brandTokens.map(([name, light, dark, use]) => (
              <Swatch key={name} name={name} light={light} dark={dark} use={use} />
            ))}
          </div>
          <h3 className="mt-8 mb-3 font-heading text-lg font-semibold text-ink">Derived</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {derivedTokens.map(([name, use]) => (
              <Swatch key={name} name={name} use={use} />
            ))}
          </div>
          <h3 className="mt-8 mb-3 font-heading text-lg font-semibold text-ink">
            Status (fixed app-wide)
          </h3>
          <div className="flex flex-wrap gap-3">
            <StatusBadge tone="success" size="lg">
              Paid · Delivered · In stock
            </StatusBadge>
            <StatusBadge tone="warning" size="lg">
              Pending · Due soon
            </StatusBadge>
            <StatusBadge tone="danger" size="lg">
              Overdue · Cancelled · Out of stock
            </StatusBadge>
            <StatusBadge tone="neutral" size="lg">
              Draft
            </StatusBadge>
          </div>
          <h3 className="mt-8 mb-3 font-heading text-lg font-semibold text-ink">Category tints</h3>
          <div className="flex flex-wrap gap-3">
            {tints.map((tint) => (
              <span
                key={tint}
                className={cn(
                  "flex size-20 items-end justify-center rounded-lg pb-2 text-xs font-semibold text-ink",
                  `bg-tint-${tint}`,
                )}
              >
                {tint}
              </span>
            ))}
          </div>
        </Section>

        <Section
          id="type"
          title="Type"
          description="Plus Jakarta Sans for headings, Inter for body and numbers, Noto Naskh Arabic for Urdu/Sindhi UI, Noto Nastaliq Urdu for large display only."
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              {typeScale.map(([cls, px]) => (
                <p key={cls} className={cn(cls, "font-heading font-semibold text-ink")}>
                  <span className="num me-3 text-xs font-normal text-muted">{px}</span>
                  Apni Dukan
                </p>
              ))}
            </div>
            <div className="flex flex-col gap-5">
              <Card className="p-5">
                <p className="text-sm text-muted">Body · Inter 16</p>
                <p className="mt-1 text-base text-ink">
                  Order stock from distributors in minutes and run your whole shop from one app.
                </p>
                <p className="mt-4 text-sm text-muted">Numbers · tabular</p>
                <p className="num mt-1 text-2xl font-bold text-ink">Rs 1,250 · Rs 21,480 · 3,500</p>
              </Card>
              <Card className="p-5" dir="rtl" lang="ur">
                <p className="text-sm text-muted">اردو · Noto Naskh Arabic</p>
                <p className="mt-1 text-lg text-ink">
                  ڈسٹری بیوٹر سے مال منگوائیں اور پوری دکان ایک ایپ سے چلائیں۔
                </p>
                <p className="mt-4 font-nastaliq text-3xl leading-[2.1] text-ink">
                  اپنی دکان۔ اب آپ کے گھر تک۔
                </p>
                <p className="mt-2 text-sm text-muted">Nastaliq: display headings only</p>
              </Card>
            </div>
          </div>
        </Section>

        <Section
          id="shape"
          title="Shape, elevation and icons"
          description="4px grid. Radius: 10px controls, 14px cards, 24px bottom sheets. Soft, low shadows. Lucide only, one stroke width. Touch targets at least 48×48."
        >
          <div className="flex flex-wrap items-end gap-6">
            <Demo label="Control · 10px">
              <div className="h-12 w-32 rounded-md border border-border-strong bg-surface" />
            </Demo>
            <Demo label="Card · 14px">
              <div className="h-24 w-36 rounded-lg bg-surface shadow-card" />
            </Demo>
            <Demo label="Raised">
              <div className="h-24 w-36 rounded-lg bg-surface shadow-raised" />
            </Demo>
            <Demo label="Sheet · 24px">
              <div className="h-24 w-44 rounded-t-2xl bg-surface shadow-sheet" />
            </Demo>
          </div>
          <div className="mt-8">
            <Demo label="Icons (Lucide, 1.75 stroke)">
              {[
                ShoppingBag,
                Store,
                Truck,
                Receipt,
                Wallet,
                ClipboardList,
                Bell,
                Search,
                Mic,
                Box,
              ].map((Icon, i) => (
                <span
                  key={i}
                  className="flex size-12 items-center justify-center rounded-md bg-surface text-ink shadow-card"
                >
                  <Icon className="size-6" />
                </span>
              ))}
            </Demo>
          </div>
        </Section>

        <Section
          id="buttons"
          title="Buttons"
          description="Filled buttons use --action (AA contrast). States: default, hover, pressed (scale), loading, disabled."
        >
          <div className="flex flex-col gap-6">
            {(
              [
                "primary",
                "secondary",
                "outline",
                "soft",
                "ghost",
                "danger",
                "danger-soft",
                "link",
              ] as const
            ).map((variant) => (
              <Demo key={variant} label={variant}>
                <Button variant={variant}>
                  <ShoppingBag /> Place order
                </Button>
                <Button
                  variant={variant}
                  className={
                    variant === "primary"
                      ? "bg-action-hover"
                      : variant === "secondary" || variant === "ghost"
                        ? "bg-subtle"
                        : undefined
                  }
                >
                  Hover
                </Button>
                <Button variant={variant} loading>
                  Loading
                </Button>
                <Button variant={variant} disabled>
                  Disabled
                </Button>
              </Demo>
            ))}
            <Demo label="Sizes">
              <Button size="sm">Small 40</Button>
              <Button size="md">Medium 48</Button>
              <Button size="lg">Large 56</Button>
              <Button size="icon" aria-label="Search">
                <Search />
              </Button>
              <Button size="icon-sm" variant="secondary" aria-label="Notifications">
                <Bell />
              </Button>
            </Demo>
          </div>
        </Section>

        <Section
          id="forms"
          title="Forms"
          description="48px fields, 3:1 outlines, visible focus, clear error text. Phone numbers always +92 and LTR."
        >
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-name">Shop name</Label>
              <Input id="ds-name" placeholder="e.g. Bismillah General Store" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-phone">Mobile number</Label>
              <InputGroup dir="ltr">
                <InputGroupAddon className="num border-e border-border pe-3 font-semibold text-ink">
                  +92
                </InputGroupAddon>
                <InputGroupInput id="ds-phone" className="num ps-3" defaultValue="300 1234567" />
              </InputGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-error">With error</Label>
              <Input id="ds-error" aria-invalid defaultValue="12345" />
              <p className="text-sm font-medium text-danger-ink">
                Enter a valid Pakistani mobile number.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-amount">Amount</Label>
              <InputGroup>
                <InputGroupAddon className="font-semibold">Rs</InputGroupAddon>
                <InputGroupInput
                  id="ds-amount"
                  className="num"
                  inputMode="decimal"
                  defaultValue="1,250"
                />
              </InputGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ds-disabled">Disabled</Label>
              <Input id="ds-disabled" disabled defaultValue="Latifabad Unit 7" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Area</Label>
              <Select defaultValue="latifabad">
                <SelectTrigger aria-label="Area">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latifabad">Latifabad</SelectItem>
                  <SelectItem value="qasimabad">Qasimabad</SelectItem>
                  <SelectItem value="saddar">Saddar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="ds-notes">Notes</Label>
              <Textarea id="ds-notes" placeholder="Deliver after 4 pm" />
            </div>
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-3 text-base text-ink">
                <Checkbox defaultChecked /> In stock only
              </label>
              <label className="flex items-center gap-3 text-base text-ink">
                <Checkbox /> Has scheme
              </label>
              <label className="flex items-center gap-3 text-base text-ink">
                <Switch defaultChecked /> Dark mode
              </label>
              <RadioGroup defaultValue="cod" className="gap-3">
                <label className="flex items-center gap-3 text-base text-ink">
                  <RadioGroupItem value="cod" /> Cash on delivery
                </label>
                <label className="flex items-center gap-3 text-base text-ink">
                  <RadioGroupItem value="credit" /> Udhaar (credit)
                </label>
              </RadioGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label>OTP</Label>
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
        </Section>

        <Section id="status" title="Badges, chips and status">
          <div className="flex flex-col gap-6">
            <Demo label="Badges">
              <Badge>Neutral</Badge>
              <Badge variant="primary">Margin 14% · Rs 38/pc</Badge>
              <Badge variant="offer">12+1 free</Badge>
              <Badge variant="sale">8% OFF</Badge>
              <Badge variant="danger">Out of stock</Badge>
              <Badge variant="outline">Carton</Badge>
              <Badge variant="solid">New</Badge>
            </Demo>
            <Demo label="Filter chips">
              <ChipRow className="px-0">
                {(["stock", "scheme", "tapal", "nestle", "margin"] as const).map((id) => (
                  <FilterChip
                    key={id}
                    selected={Boolean(chips[id])}
                    onSelectedChange={(value) => setChips((c) => ({ ...c, [id]: value }))}
                    count={id === "tapal" ? 6 : undefined}
                  >
                    {
                      {
                        stock: "In stock",
                        scheme: "Has scheme",
                        tapal: "Tapal",
                        nestle: "Nestlé",
                        margin: "Margin 10%+",
                      }[id]
                    }
                  </FilterChip>
                ))}
              </ChipRow>
            </Demo>
            <Demo label="Applied filter">
              <Chip onRemove={() => toast("Filter removed")} removeLabel="Remove Latifabad">
                Latifabad
              </Chip>
            </Demo>
            <Demo label="Progress (minimum order)">
              <div className="w-full max-w-sm">
                <p className="num mb-2 text-sm text-ink">Rs 1,200 more for free delivery</p>
                <Progress value={3800} max={5000} />
              </div>
            </Demo>
            <Demo label="Avatars and keys">
              <Avatar>
                <AvatarFallback name="Ahmed Ali" />
              </Avatar>
              <Avatar className="rounded-md">
                <AvatarFallback name="Indus Traders" className="rounded-md" />
              </Avatar>
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </Demo>
          </div>
        </Section>

        <Section
          id="navigation"
          title="Navigation"
          description="Mobile bottom nav with the raised Munshi mic; tabs; segmented controls."
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="relative h-[220px] [transform:translateZ(0)] overflow-hidden rounded-2xl border border-border bg-canvas">
              <p className="p-4 text-sm text-muted">
                Bottom nav (Munshi: tap to type or talk, hold to talk)
              </p>
              <BottomNav
                items={[...(mobileTabs.dukandar ?? []), ...(mobileTabs.customer ?? [])].slice(0, 4)}
                className="absolute"
              />
            </div>
            <div className="flex flex-col gap-6">
              <Tabs defaultValue="new">
                <TabsList>
                  <TabsTrigger value="new">New</TabsTrigger>
                  <TabsTrigger value="packed">Packed</TabsTrigger>
                  <TabsTrigger value="delivered">Delivered</TabsTrigger>
                </TabsList>
                <TabsContent value="new" className="pt-3 text-sm text-muted">
                  Underlined tabs for page sections.
                </TabsContent>
                <TabsContent value="packed" className="pt-3 text-sm text-muted">
                  Packed orders.
                </TabsContent>
                <TabsContent value="delivered" className="pt-3 text-sm text-muted">
                  Delivered orders.
                </TabsContent>
              </Tabs>
              <Tabs defaultValue="today">
                <TabsList variant="segmented">
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
              </Tabs>
              <ToggleGroup type="single" defaultValue="carton" aria-label="Unit">
                <ToggleGroupItem value="piece">Piece</ToggleGroupItem>
                <ToggleGroupItem value="dozen">Dozen</ToggleGroupItem>
                <ToggleGroupItem value="carton">Carton</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </Section>

        <Section
          id="commerce"
          title="Commerce"
          description="The product card is the most important component: image, discount, scheme, pack size, unit toggle, trade price over MRP, margin, MOQ, ETA and the ADD→stepper morph."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <ProductCard
              product={sampleProducts.tea as ProductCardData}
              unitId={units.tea ?? "ctn"}
              onUnitChange={(id) => setUnits((u) => ({ ...u, tea: id }))}
              quantity={qty.tea ?? 0}
              onQuantityChange={(n) => setQty((q) => ({ ...q, tea: n }))}
            />
            <ProductCard
              product={sampleProducts.milk as ProductCardData}
              unitId="pc"
              onUnitChange={() => undefined}
              quantity={qty.milk ?? 0}
              onQuantityChange={(n) => setQty((q) => ({ ...q, milk: n }))}
            />
            <ProductCard
              product={sampleProducts.oil as ProductCardData}
              unitId="pc"
              onUnitChange={() => undefined}
              quantity={0}
              onQuantityChange={() => undefined}
              notifyRequested={notified}
              onNotifyMe={() => {
                setNotified(true);
                toast.success("We'll tell you when it is back");
              }}
            />
            <ProductCardSkeleton />
          </div>
          <div className="mt-8 flex flex-wrap items-end gap-8">
            <Demo label="ADD → stepper">
              <AddToCart
                quantity={qty.demo ?? 0}
                onQuantityChange={(n) => setQty((q) => ({ ...q, demo: n }))}
                productName="Lux soap"
              />
              <AddToCart
                quantity={3}
                onQuantityChange={() => undefined}
                productName="Lux soap"
                size="lg"
              />
            </Demo>
            <Demo label="Price">
              <Price paisa={172000} strikePaisa={189000} size="lg" />
              <Price paisa={33500} />
            </Demo>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="relative h-36 [transform:translateZ(0)] overflow-hidden rounded-2xl border border-border bg-canvas">
              <p className="p-4 text-sm text-muted">
                Sticky cart bar (slides up after the first add)
              </p>
              <CartBar
                itemCount={3}
                totalPaisa={2410500}
                savingsPaisa={128000}
                href="/dev/design-system#commerce"
                aboveBottomNav={false}
                className="absolute"
              />
            </div>
          </div>
        </Section>

        <Section
          id="overlays"
          title="Sheets, dialogs, menus and toasts"
          description="Bottom sheets (24px, drag to dismiss), side panels on desktop, dialogs, menus, tooltips and toasts with Undo."
        >
          <div className="flex flex-wrap gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">Bottom sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>
                    Brand, price, margin, scheme, distributor, in stock.
                  </SheetDescription>
                </SheetHeader>
                <SheetBody>
                  <div className="flex flex-col gap-4">
                    {["Tapal", "Lipton", "Nestlé", "Shan", "National"].map((brand) => (
                      <label key={brand} className="flex items-center gap-3 text-base text-ink">
                        <Checkbox /> {brand}
                      </label>
                    ))}
                  </div>
                </SheetBody>
                <SheetFooter>
                  <Button variant="secondary" className="flex-1">
                    Clear
                  </Button>
                  <Button className="flex-1">Show 24 items</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">Side panel</Button>
              </SheetTrigger>
              <SheetContent side="end">
                <SheetHeader>
                  <SheetTitle>Order TD-2610-00123</SheetTitle>
                  <SheetDescription>Bismillah Store · Latifabad</SheetDescription>
                </SheetHeader>
                <SheetBody>
                  <StatusBadge tone="warning">Packed</StatusBadge>
                </SheetBody>
              </SheetContent>
            </Sheet>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel this order?</DialogTitle>
                  <DialogDescription>The distributor will be told straight away.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="secondary">Keep order</Button>
                  <Button variant="danger">Cancel order</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Order</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Receipt /> Invoice PDF
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Truck /> Track
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="danger">Cancel order</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary">Popover</Button>
              </PopoverTrigger>
              <PopoverContent>
                <p className="text-sm font-semibold text-ink">Scheme: 12+1 free</p>
                <p className="mt-1 text-sm text-muted">
                  Buy 12 pouches, get 1 free. Until 30/11/2026.
                </p>
              </PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary">Tooltip</Button>
              </TooltipTrigger>
              <TooltipContent>Trade price per piece</TooltipContent>
            </Tooltip>
            <Button variant="secondary" onClick={() => toast.success("Added to khata")}>
              Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast("Ahmed bhai: Rs 750 udhaar added", {
                  action: { label: "Undo", onClick: () => toast("Entry removed") },
                  duration: 10000,
                })
              }
            >
              Toast with Undo
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.error("Could not save. Check your internet.")}
            >
              Error toast
            </Button>
          </div>
        </Section>

        <Section
          id="states"
          title="States"
          description="Every screen has designed loading (skeletons that match the layout), empty (awning + one action), error (Retry) and offline states."
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <EmptyState
                icon={PackageSearch}
                title="No orders yet"
                description="Your orders to distributors will show here."
                action={
                  <Button>
                    Start ordering <ChevronRight className="rtl:-scale-x-100" />
                  </Button>
                }
              />
            </Card>
            <Card>
              <ErrorState onRetry={() => toast("Retrying…")} />
            </Card>
            <Card>
              <ErrorState kind="offline" onRetry={() => toast("Retrying…")} />
            </Card>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="p-4">
              <ListRowSkeleton />
              <ListRowSkeleton />
              <ListRowSkeleton />
            </Card>
            <StatCardSkeleton />
            <Card className="flex flex-col gap-3 p-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          </div>
          <Card className="mt-6">
            <CardHeader>
              <div>
                <CardTitle>Card</CardTitle>
                <CardDescription>
                  Surfaces sit on the canvas; never a card inside a card.
                </CardDescription>
              </div>
              <StatusBadge tone="success">Paid</StatusBadge>
            </CardHeader>
            <CardContent className="text-sm text-ink">
              Rs 21,480 · 14 items · Indus Traders
            </CardContent>
            <CardFooter>
              <Button variant="soft" size="sm">
                <CloudOff /> Works offline
              </Button>
            </CardFooter>
          </Card>
        </Section>
      </main>
    </div>
  );
}
