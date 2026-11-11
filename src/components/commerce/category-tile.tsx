import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";

export type CategoryTint = "green" | "amber" | "peach" | "teal" | "sand" | "sky";

const tintClass: Record<CategoryTint, string> = {
  green: "bg-tint-green",
  amber: "bg-tint-amber",
  peach: "bg-tint-peach",
  teal: "bg-tint-teal",
  sand: "bg-tint-sand",
  sky: "bg-tint-sky",
};

type CategoryTileProps = {
  href: string;
  name: string;
  imageUrl?: string | null;
  /** Shown on the tint when there is no photo. */
  icon?: LucideIcon;
  tint?: CategoryTint;
  /** The category being looked at now (a ring and a bolder name). */
  active?: boolean;
  className?: string;
};

/**
 * A category as a small lit tile: the photo fills a rounded square with a soft top highlight
 * and a lifted shadow, name underneath. Without a photo, an icon sits on the category tint.
 */
function CategoryTile({
  href,
  name,
  imageUrl,
  icon: Icon,
  tint = "green",
  active = false,
  className,
}: CategoryTileProps) {
  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn("group flex w-full flex-col items-center gap-1.5 rounded-md", className)}
    >
      <span
        className={cn(
          "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-active:scale-[0.96]",
          active ? "shadow-raised ring-2 ring-primary" : "shadow-card ring-1 ring-border/60",
          tintClass[tint],
        )}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 120px, 23vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : Icon ? (
          <Icon aria-hidden className="size-9 text-primary-strong/80" />
        ) : (
          <span aria-hidden className="font-heading text-2xl font-bold text-ink/30">
            {name.slice(0, 1)}
          </span>
        )}
        {/* Top-lit glaze: reads as a glossy, slightly raised tile. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg bg-[linear-gradient(180deg,rgb(255_255_255/0.28),transparent_45%)] dark:bg-[linear-gradient(180deg,rgb(255_255_255/0.08),transparent_45%)]"
        />
      </span>
      <span
        className={cn(
          "line-clamp-2 text-center text-xs leading-4",
          active ? "font-bold text-primary-strong" : "font-semibold text-ink",
        )}
      >
        {name}
      </span>
    </Link>
  );
}

export { CategoryTile };
