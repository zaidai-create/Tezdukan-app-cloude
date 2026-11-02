"use client";

import { useEffect } from "react";
import { z } from "zod";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useCartCount } from "@/features/ordering/queries";
import type { StorefrontProduct } from "./schemas";

/**
 * The shopper's cart, kept on the phone (one per device) and grouped by dukan at checkout.
 * Prices are snapshots for display; the dukan confirms the final bill.
 */
const cartLineSchema = z.object({
  id: z.uuid(),
  shopId: z.uuid(),
  shopName: z.string(),
  shopSlug: z.string(),
  name: z.string(),
  packSize: z.string().nullable(),
  pricePaisa: z.number().int().nonnegative(),
  mrpPaisa: z.number().int().nonnegative().nullable(),
  imagePath: z.string().nullable(),
  quantity: z.number().int().positive().max(999),
});
export type CartLine = z.infer<typeof cartLineSchema>;

const storedSchema = z.object({
  lines: z.array(cartLineSchema).catch([]),
  address: z.string().max(300).catch(""),
});

type CartState = {
  lines: CartLine[];
  address: string;
  setQuantity: (product: StorefrontProduct, quantity: number) => void;
  setAddress: (address: string) => void;
  clearShop: (shopId: string) => void;
};

export const useCustomerCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      address: "",
      setQuantity: (product, quantity) =>
        set((state) => {
          const rest = state.lines.filter((line) => line.id !== product.id);
          if (quantity <= 0) return { lines: rest };
          const existing = state.lines.find((line) => line.id === product.id);
          const line: CartLine = {
            id: product.id,
            shopId: product.shop_id,
            shopName: product.shop_name,
            shopSlug: product.shop_slug,
            name: product.name,
            packSize: product.pack_size_label,
            pricePaisa: product.selling_price_paisa,
            mrpPaisa: product.mrp_paisa,
            imagePath: product.image_path,
            quantity: Math.min(quantity, 999),
          };
          // Keep the line where it was so the cart doesn't jump while a stepper is tapped.
          return {
            lines: existing
              ? state.lines.map((current) => (current.id === product.id ? line : current))
              : [...state.lines, line],
          };
        }),
      setAddress: (address) => set({ address: address.slice(0, 300) }),
      clearShop: (shopId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.shopId !== shopId) })),
    }),
    {
      name: "td-customer-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines, address: state.address }),
      merge: (persisted, current) => ({ ...current, ...storedSchema.parse(persisted ?? {}) }),
    },
  ),
);

export const cartItemCount = (lines: readonly CartLine[]) =>
  lines.reduce((sum, line) => sum + line.quantity, 0);

export function useLineQuantity(productId: string): number {
  return useCustomerCart(
    (state) => state.lines.find((line) => line.id === productId)?.quantity ?? 0,
  );
}

/** Keeps the nav dock's cart badge in step with the shopper's cart. */
export function CustomerCartBadgeSync() {
  const count = useCustomerCart((state) => cartItemCount(state.lines));
  useEffect(() => {
    useCartCount.getState().set(count);
  }, [count]);
  return null;
}
