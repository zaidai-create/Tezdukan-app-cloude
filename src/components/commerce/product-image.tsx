"use client";

import { cn } from "cn";
import { type LucideIcon, Package } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { tintFor } from "@/components/ui/avatar";
import { shortName } from "./short-name";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  /** next/image `sizes`; defaults suit a 2-column mobile grid / 6-column desktop grid. */
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Category tiles sit on a tint; product images sit on white. */
  surface?: "white" | "none";
  /** Without a photo: the product's category icon and a caption (brand) instead of initials. */
  fallbackIcon?: LucideIcon;
  fallbackCaption?: string;
};

// Neutral 4x4 placeholder shown while the real image streams in.
const BLUR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA0IDQnPjxyZWN0IHdpZHRoPSc0JyBoZWlnaHQ9JzQnIGZpbGw9JyNlZWYzZjAnLz48L3N2Zz4=";

/**
 * Square product photo on a soft surface, object-contain, lazy, AVIF/WebP via next/image. If there is
 * no image or it fails to load, a tile with the category's icon (or a pack) and the brand name
 * takes its place: it reads as "no photo yet", never as a broken image or a pair of initials.
 */
function ProductImage({
  src,
  alt,
  sizes = "(min-width: 1024px) 180px, (min-width: 640px) 30vw, 45vw",
  priority = false,
  className,
  surface = "white",
  fallbackIcon: FallbackIcon = Package,
  fallbackCaption,
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
            "@container flex size-full flex-col items-center justify-center gap-1.5 font-heading font-bold tracking-tight",
            tintFor(alt),
          )}
        >
          <span className="flex aspect-square w-[56%] max-w-16 items-center justify-center rounded-full bg-surface/70 shadow-card @min-[5.5rem]:w-[40%]">
            <FallbackIcon aria-hidden className="size-1/2" strokeWidth={1.75} />
          </span>
          {/* Decorative: the name is already the image's label. Thumbnails keep the icon only. */}
          <span
            aria-hidden
            className="hidden max-w-[88%] truncate text-xs @min-[5.5rem]:block @min-[9rem]:text-sm"
          >
            {fallbackCaption ?? shortName(alt)}
          </span>
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
          className="object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export { ProductImage };
