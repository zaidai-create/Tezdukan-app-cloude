"use client";

import { cn } from "cn";
import { ChevronRight, Mic, PackagePlus, Plus, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ProductImage } from "@/components/commerce/product-image";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { storageUrl } from "@/features/ordering/images";
import { formatRs } from "@/lib/money";
import type { ShopProduct, StarterItem } from "../schemas";
import { AddProductSheet } from "./add-product-sheet";
import { EditProductSheet } from "./edit-product-sheet";
import { StarterPack } from "./starter-pack";

const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, " ").trim();

type Filter = "all" | "low" | "hidden";

/** The dukan's shelf: find, add and re-price products, with common products a tap away. */
export function ProductsView({
  products,
  starter,
}: {
  products: ShopProduct[];
  starter: StarterItem[];
}) {
  const t = useTranslations("shopProducts");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState<"off" | "type" | "voice">("off");
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [packOpen, setPackOpen] = useState(products.length < 12);

  const low = products.filter((p) => p.qty_on_hand <= p.low_stock_threshold);
  const hidden = products.filter((p) => !p.is_visible_online);
  const q = normalize(query);
  const shown = (filter === "low" ? low : filter === "hidden" ? hidden : products).filter(
    (p) => !q || normalize(`${p.name} ${p.name_ur ?? ""} ${p.pack_size_label ?? ""}`).includes(q),
  );

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t("filters.all", { count: products.length }) },
    { id: "low", label: t("filters.low", { count: low.length }) },
    { id: "hidden", label: t("filters.hidden", { count: hidden.length }) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink lg:text-3xl">{t("title")}</h1>
          <p className="num text-sm text-muted">
            {t("subtitle", { count: products.length, low: low.length })}
          </p>
        </div>
      </header>

      {/* The three ways to add, big and labelled: type, speak, or the common-products pack. */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setAdding("type")}
          className="sheen flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg bg-action p-2 text-center font-semibold text-on-action shadow-glow inset-shadow-edge active:scale-[0.98]"
        >
          <Plus aria-hidden className="size-6" />
          <span className="text-sm leading-tight">{t("actions.add")}</span>
        </button>
        <button
          type="button"
          onClick={() => setAdding("voice")}
          className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-border/60 bg-surface p-2 text-center font-semibold text-ink shadow-card active:scale-[0.98]"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
            <Mic aria-hidden className="size-5" />
          </span>
          <span className="text-sm leading-tight">{t("actions.speak")}</span>
        </button>
        <button
          type="button"
          onClick={() => setPackOpen((open) => !open)}
          aria-expanded={packOpen}
          disabled={starter.length === 0}
          className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-border/60 bg-surface p-2 text-center font-semibold text-ink shadow-card active:scale-[0.98] disabled:opacity-50"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-awning-soft text-awning-ink">
            <PackagePlus aria-hidden className="size-5" />
          </span>
          <span className="text-sm leading-tight">{t("actions.common")}</span>
        </button>
      </div>

      {packOpen && starter.length > 0 ? (
        <StarterPack
          key={starter.map((item) => item.id).join()}
          items={starter}
          onDone={() => setPackOpen(false)}
        />
      ) : null}

      {products.length === 0 ? (
        packOpen ? null : (
          <EmptyState
            icon={PackagePlus}
            title={t("emptyTitle")}
            description={t("emptyHint")}
            action={
              <Button onClick={() => setPackOpen(true)}>
                <PackagePlus aria-hidden />
                {t("actions.common")}
              </Button>
            }
          />
        )
      ) : (
        <section className="flex flex-col gap-3">
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchMine")}
              aria-label={t("searchMine")}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("clear")}
                className="me-1 flex size-10 items-center justify-center rounded-full text-muted"
              >
                <X aria-hidden className="size-5" />
              </button>
            ) : null}
          </InputGroup>

          <div role="tablist" aria-label={t("title")} className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "num h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors duration-150",
                  filter === item.id
                    ? "border-ink bg-ink text-surface"
                    : "border-border-strong bg-surface text-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
              {t("noMatch")}
            </p>
          ) : (
            <ul aria-label={t("title")} className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {shown.map((product) => {
                const out = product.qty_on_hand <= 0;
                const isLow = !out && product.qty_on_hand <= product.low_stock_threshold;
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(product)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-surface p-2.5 text-start shadow-card transition-transform duration-150 ease-out active:scale-[0.99]"
                    >
                      <ProductImage
                        src={storageUrl(product.image_path)}
                        alt={product.name}
                        sizes="56px"
                        className="size-14 shrink-0 rounded-md"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm leading-tight font-semibold text-ink">
                          {product.name}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                          <span
                            className={cn(
                              "num rounded-full px-2 py-0.5 font-semibold",
                              out
                                ? "bg-danger-soft text-danger-ink"
                                : isLow
                                  ? "bg-awning-soft text-awning-ink"
                                  : "bg-primary-soft text-primary-strong",
                            )}
                          >
                            {out
                              ? t("out")
                              : t("inStock", { count: Math.floor(product.qty_on_hand) })}
                          </span>
                          {product.is_visible_online ? null : (
                            <span className="rounded-full bg-subtle px-2 py-0.5 font-semibold text-muted">
                              {t("hiddenBadge")}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="num font-heading text-lg font-bold whitespace-nowrap text-ink">
                        {formatRs(product.selling_price_paisa)}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="size-5 shrink-0 text-muted rtl:-scale-x-100"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {adding !== "off" ? (
        <AddProductSheet listenOnOpen={adding === "voice"} onClose={() => setAdding("off")} />
      ) : null}
      {editing ? (
        <EditProductSheet key={editing.id} product={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
