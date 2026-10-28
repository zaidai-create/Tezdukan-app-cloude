/**
 * Shrinks a photo in the browser before it is uploaded or read by Munshi: phones shoot
 * 4000 px images, a product card needs far less, and mobile data is precious.
 */
export async function resizeImage(
  file: File,
  maxSide = 1280,
  quality = 0.82,
): Promise<{ blob: Blob; base64: string; mediaType: "image/jpeg" | "image/webp" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  // WebP where the browser can write it (Chrome on Android), JPEG otherwise (older Safari).
  let mediaType: "image/jpeg" | "image/webp" = "image/webp";
  let blob = await toBlob(mediaType);
  if (!blob || blob.type !== "image/webp") {
    mediaType = "image/jpeg";
    blob = await toBlob(mediaType);
  }
  if (!blob) throw new Error("Could not encode the photo");

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { blob, base64: btoa(binary), mediaType };
}
