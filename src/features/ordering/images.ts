import { publicEnv } from "@/lib/env";

/**
 * Public URL of an object in a public storage bucket. Built locally (no client needed), so
 * server and client components produce the same URL for next/image.
 */
export function storageUrl(
  path: string | null | undefined,
  bucket: "product-images" | "shop-media" = "product-images",
): string | null {
  if (!path) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encoded}`;
}
