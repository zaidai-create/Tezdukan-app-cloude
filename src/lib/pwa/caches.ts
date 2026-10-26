/**
 * Service worker caches that hold one account's screens (HTML and RSC payloads). They are
 * cleared on sign-out so the next person on a shared shop phone cannot open them offline.
 * Shared with `src/app/sw.ts`.
 */
export const privateCacheNames = { pages: "pages", rsc: "pages-rsc" } as const;

/** Deletes the private caches; safe to call where Cache Storage is unavailable. */
export async function clearPrivateCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  await Promise.all(Object.values(privateCacheNames).map((name) => caches.delete(name))).catch(
    () => undefined,
  );
}
