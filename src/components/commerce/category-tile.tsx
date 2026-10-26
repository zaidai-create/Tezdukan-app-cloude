import { cn } from "cn";
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
  tint?: CategoryTint;
  className?: string;
};

/** Blinkit-style tile: real product photo on a soft tinted square, name underneath. */
function CategoryTile({ href, name, imageUrl, tint = "green", className }: CategoryTileProps) {
  return (
    <Link
      href={href}
      prefetch
      className={cn("group flex w-full flex-col items-center gap-1.5 rounded-md", className)}
    >
      <span
        className={cn(
          "relative flex aspect-square w-full items-end justify-center overflow-hidden rounded-lg transition-transform duration-150 group-active:scale-[0.97]",
          tintClass[tint],
        )}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 120px, 24vw"
            className="object-contain p-2"
          />
        ) : (
          <span aria-hidden className="mb-3 font-heading text-2xl font-bold text-ink/30">
            {name.slice(0, 1)}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-center text-xs leading-4 font-semibold text-ink">
        {name}
      </span>
    </Link>
  );
}

export { CategoryTile };
