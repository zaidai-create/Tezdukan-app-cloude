"use client";

import { cn } from "cn";
import Image from "next/image";
import { useState } from "react";
import { initialsOf, tintFor } from "@/components/ui/avatar";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  /** next/image `sizes`; defaults suit a 2-column mobile grid / 6-column desktop grid. */
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Category tiles sit on a tint; product images sit on white. */
  surface?: "white" | "none";
};

// Neutral 4x4 placeholder shown while the real image streams in.
const BLUR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA0IDQnPjxyZWN0IHdpZHRoPSc0JyBoZWlnaHQ9JzQnIGZpbGw9JyNlZWYzZjAnLz48L3N2Zz4=";

/**
 * Square product photo on white, object-contain, lazy, AVIF/WebP via next/image. If there is
 * no image or it fails to load, a branded tile with the product initials takes its place —
 * never a broken-image icon.
 */
function ProductImage({
  src,
  alt,
  sizes = "(min-width: 1024px) 180px, (min-width: 640px) 30vw, 45vw",
  priority = false,
  className,
  surface = "white",
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;
  return (
    <div
      data-slot="product-image"
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-md",
        surface === "white" && "bg-image-surface",
        className,
      )}
    >
      {showFallback ? (
        <div
          aria-label={alt}
          role="img"
          className={cn(
            "flex size-full items-center justify-center font-heading text-3xl font-bold tracking-tight",
            tintFor(alt),
          )}
        >
          {initialsOf(alt)}
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          placeholder="blur"
          blurDataURL={BLUR}
          className="object-contain p-2"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export { ProductImage };
