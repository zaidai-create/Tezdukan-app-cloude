"use client";

import { useEffect } from "react";
import { z } from "zod";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useCartCount } from "@/features/ordering/queries";
import type { StorefrontProduct } from "./schemas";

/**
 * The shopper's cart, kept on the phone (one per device) and grouped by dukan at checkout.
 * Prices are snapshots for display; the dukan confirms the final bill. The delivery address is
 * not kept here: it is a saved address chosen with the delivery point (see location-cookie).
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

export const deliveryInstructions = ["callOnArrival", "ringBell", "leaveAtDoor", "noBell"] as const;
export type DeliveryInstruction = (typeof deliveryInstructions)[number];

/** What to do when an item is not on the dukan's shelf (the dukan sees it on the order). */
export const unavailableChoices = ["call_me", "replace", "remove"] as const;
export type UnavailableChoice = (typeof unavailableChoices)[number];

const storedSchema = z.object({
  lines: z.array(cartLineSchema).catch([]),
  instructions: z.array(z.enum(deliveryInstructions)).catch([]),
  note: z.string().max(200).catch(""),
  ifUnavailable: z.enum(unavailableChoices).catch("call_me"),
});
type Stored = z.infer<typeof storedSchema>;

type CartState = Stored & {
  setQuantity: (product: StorefrontProduct, quantity: number) => void;
  setDelivery: (patch: Partial<Omit<Stored, "lines">>) => void;
  toggleInstruction: (instruction: DeliveryInstruction) => void;
  clearShop: (shopId: string) => void;
};

export const useCustomerCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      instructions: [],
      note: "",
      ifUnavailable: "call_me",
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
      setDelivery: (patch) => set(patch),
      toggleInstruction: (instruction) =>
        set((state) => ({
          instructions: state.instructions.includes(instruction)
            ? state.instructions.filter((item) => item !== instruction)
            : [...state.instructions, instruction],
        })),
      clearShop: (shopId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.shopId !== shopId) })),
    }),
    {
      name: "td-customer-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state): Stored => ({
        lines: state.lines,
        instructions: state.instructions,
        note: state.note,
        ifUnavailable: state.ifUnavailable,
      }),
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
