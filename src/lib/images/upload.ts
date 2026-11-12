"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// kyc-documents is private: CNIC and shop photos sent with a registration, under <uid>/.
export type ImageBucket = "product-images" | "shop-media" | "kyc-documents";

/**
 * Phone photos are large (4-12 MB) and often sideways: shrink to `maxSide` pixels on the long
 * side, keep the camera's orientation, and save as WebP, so uploads are quick on mobile data.
 */
export async function compressImage(file: File, maxSide: number, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no_canvas");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (blob && blob.type === "image/webp") return blob;
  // Older WebViews cannot write WebP: JPEG instead.
  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!jpeg) throw new Error("encode_failed");
  return jpeg;
}

/** Uploads a photo into `folder` (e.g. shop/<id>/products) and returns its storage path. */
export async function uploadImage(
  bucket: ImageBucket,
  folder: string,
  file: File,
  maxSide: number,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not_an_image");
  const blob = await compressImage(file, maxSide);
  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  // A new name every time: phones and the CDN never show an old photo for a new one.
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabaseBrowserClient()
    .storage.from(bucket)
    .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}
