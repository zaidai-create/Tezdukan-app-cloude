/** TanStack Query keys shared by server prefetching and client hooks. */
export const cartKey = (shopId: string) => ["cart", shopId] as const;
