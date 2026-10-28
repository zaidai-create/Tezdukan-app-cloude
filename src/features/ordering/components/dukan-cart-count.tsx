import { connection } from "next/server";
import { getShellSession } from "@/lib/auth/session";
import { CartCountSync } from "./cart-count-sync";

/** Reads the active shop (request-time, so it sits in its own Suspense) for the cart badge. */
async function DukanCartCount() {
  await connection();
  const session = await getShellSession();
  if (session?.activeRole !== "dukandar" || !session.activeContextId) return null;
  return <CartCountSync shopId={session.activeContextId} />;
}

export { DukanCartCount };
