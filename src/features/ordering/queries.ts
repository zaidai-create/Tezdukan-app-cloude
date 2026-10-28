"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { haptic } from "@/lib/haptics";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { orderingErrorKey } from "./errors";
import { cartKey } from "./keys";
import {
  cartSummarySchema,
  catalogListSchema,
  emptyCart,
  productDetailSchema,
  slotListSchema,
  type CartGroup,
  type CartSummary,
  type CatalogItem,
  type PackUnit,
} from "./schemas";

/**
 * Client data hooks for dukandar ordering (TanStack Query over the ordering RPCs).
 * The cart is one cached summary per shop; every change returns the whole priced summary,
 * so totals, schemes and problems always come from the server.
 */

export { cartKey };

/** Item count for the nav badge, shared outside the query cache (the nav has no shop id). */
export const useCartCount = create<{ count: number; set: (count: number) => void }>((set) => ({
  count: 0,
  set: (count) => set({ count }),
}));

async function fetchCart(shopId: string): Promise<CartSummary> {
  const { data, error } = await getSupabaseBrowserClient().rpc("cart_summary", {
    p_shop_id: shopId,
  });
  if (error) throw new Error(error.message);
  return cartSummarySchema.parse(data);
}

export function useCart(shopId: string, initialData?: CartSummary) {
  const query = useQuery({
    queryKey: cartKey(shopId),
    queryFn: () => fetchCart(shopId),
    initialData,
    staleTime: 15_000,
  });
  const setCount = useCartCount((s) => s.set);
  const count = query.data?.item_count;
  useEffect(() => {
    if (count !== undefined) setCount(count);
  }, [count, setCount]);
  return query;
}

/** Quantity in the cart for one product in one pack size. */
export function quantityIn(cart: CartSummary | undefined, productId: string, packUnitId: string) {
  for (const group of cart?.groups ?? []) {
    for (const line of group.items) {
      if (line.distributor_product_id === productId && line.pack_unit_id === packUnitId) {
        return line.quantity;
      }
    }
  }
  return 0;
}

export type SetCartItem = {
  productId: string;
  unitId: string;
  quantity: number;
  /** For the Undo toast when a line is removed. */
  name: string;
  /** Quantity before this change, for Undo when a line is removed. */
  previous?: number;
  source?: "manual" | "munshi" | "parchi" | "reorder" | "booker";
  /** Product and pack, so a brand-new line can show before the server answers. */
  add?: { item: CatalogItem; unit: PackUnit };
};

/** The cart as it will be once a change lands, so steppers react instantly. */
function optimisticCart(cart: CartSummary, change: SetCartItem): CartSummary {
  const { productId, unitId, quantity } = change;
  let found = false;
  const groups: CartGroup[] = cart.groups
    .map((group) => {
      const items = group.items
        .map((line) => {
          if (line.distributor_product_id !== productId || line.pack_unit_id !== unitId)
            return line;
          found = true;
          return quantity === 0
            ? null
            : {
                ...line,
                quantity,
                line_total_paisa: line.unit_price_paisa * quantity - line.line_discount_paisa,
              };
        })
        .filter((line) => line !== null);
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);

  if (!found && quantity > 0 && change.add) {
    const { item, unit } = change.add;
    const piece = item.price_paisa;
    const line = {
      cart_item_id: crypto.randomUUID(),
      distributor_product_id: productId,
      item,
      pack_unit_id: unit.id,
      pack_label: unit.label,
      base_qty_per_unit: unit.base_qty,
      quantity,
      piece_price_paisa: piece,
      unit_price_paisa: piece * unit.base_qty,
      line_discount_paisa: 0,
      line_total_paisa: piece * unit.base_qty * quantity,
      free_base_qty: 0,
      scheme_applied: null,
      problems: [],
    };
    const existing = groups.find((g) => g.org_id === item.org_id);
    if (existing) existing.items = [...existing.items, line];
    else {
      groups.push({
        org_id: item.org_id,
        org_name: item.org_name,
        logo_path: null,
        account_status: "none",
        credit_limit_paisa: 0,
        credit_available_paisa: 0,
        min_order_paisa: 0,
        delivery_fee_paisa: 0,
        free_delivery_above_paisa: null,
        subtotal_paisa: 0,
        scheme_discount_paisa: 0,
        delivery_charge_paisa: 0,
        total_paisa: 0,
        meets_minimum: true,
        short_by_paisa: 0,
        next_slots: [],
        items: [line],
      });
    }
  }

  const withTotals = groups.map((group) => {
    const subtotal = group.items.reduce(
      (sum, line) => sum + line.unit_price_paisa * line.quantity,
      0,
    );
    const discount = group.items.reduce((sum, line) => sum + line.line_discount_paisa, 0);
    return {
      ...group,
      subtotal_paisa: subtotal,
      scheme_discount_paisa: discount,
      total_paisa: subtotal - discount + group.delivery_charge_paisa,
    };
  });
  return {
    item_count: withTotals.reduce((sum, group) => sum + group.items.length, 0),
    total_paisa: withTotals.reduce((sum, group) => sum + group.total_paisa, 0),
    groups: withTotals,
  };
}

// The newest change per cart wins: older responses arriving late never overwrite it.
const latestChange = new Map<string, number>();

export function useSetCartItem(shopId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("ordering");
  const mutation = useMutation({
    // One cart change at a time, in the order the dukandar made them.
    scope: { id: `cart:${shopId}` },
    mutationFn: async (change: SetCartItem & { seq: number }) => {
      const { data, error } = await getSupabaseBrowserClient().rpc("set_cart_item", {
        p_shop_id: shopId,
        p_distributor_product_id: change.productId,
        p_pack_unit_id: change.unitId,
        p_quantity: change.quantity,
        p_source: change.source ?? "manual",
      });
      if (error) throw new Error(error.message);
      return cartSummarySchema.parse(data);
    },
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: cartKey(shopId) });
      const current = queryClient.getQueryData<CartSummary>(cartKey(shopId)) ?? emptyCart;
      queryClient.setQueryData(cartKey(shopId), optimisticCart(current, change));
    },
    onSuccess: (summary, change) => {
      if (latestChange.get(shopId) === change.seq) {
        queryClient.setQueryData(cartKey(shopId), summary);
      }
    },
    onError: (error) => {
      haptic("warning");
      toast.error(t(`errors.${orderingErrorKey(error)}`));
      void queryClient.invalidateQueries({ queryKey: cartKey(shopId) });
    },
  });

  return (change: SetCartItem) => {
    const seq = (latestChange.get(shopId) ?? 0) + 1;
    latestChange.set(shopId, seq);
    mutation.mutate({ ...change, seq });
    if (change.quantity === 0 && change.previous) {
      const previous = change.previous;
      toast(t("removedFromCart", { name: change.name }), {
        action: {
          label: t("undo"),
          onClick: () => {
            const undoSeq = (latestChange.get(shopId) ?? 0) + 1;
            latestChange.set(shopId, undoSeq);
            mutation.mutate({ ...change, quantity: previous, seq: undoSeq });
          },
        },
      });
    }
  };
}

export function replaceCart(queryClient: QueryClient, shopId: string, summary: CartSummary) {
  queryClient.setQueryData(cartKey(shopId), summary);
}

export function useCatalogSearch(shopId: string, query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["search", shopId, q],
    enabled: q.length >= 2,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowserClient().rpc("search_catalog", {
        p_shop_id: shopId,
        p_query: q,
        p_limit: 40,
      });
      if (error) throw new Error(error.message);
      return catalogListSchema.parse(data);
    },
  });
}

export function useProductDetail(shopId: string, productId: string | null) {
  return useQuery({
    queryKey: ["product", shopId, productId],
    enabled: Boolean(productId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowserClient().rpc("product_detail", {
        p_shop_id: shopId,
        p_distributor_product_id: productId ?? "",
      });
      if (error) throw new Error(error.message);
      return productDetailSchema.parse(data);
    },
  });
}

export function useDeliverySlots(shopId: string, orgId: string) {
  return useQuery({
    queryKey: ["slots", shopId, orgId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowserClient().rpc("delivery_slots", {
        p_shop_id: shopId,
        p_org_id: orgId,
        p_days: 4,
      });
      if (error) throw new Error(error.message);
      return slotListSchema.parse(data);
    },
  });
}

/** Which product sheet is open (one sheet per page, opened from any card). */
export const useProductSheet = create<{
  productId: string | null;
  open: (productId: string) => void;
  close: () => void;
}>((set) => ({
  productId: null,
  open: (productId) => set({ productId }),
  close: () => set({ productId: null }),
}));
