import { cn } from "cn";
import { useId } from "react";
import type * as React from "react";
import { type Gradient, logoColors, mark, markPaint, tile, wordmark } from "@/lib/brand/logo-art";

function GradientDef({ id, paint }: { id: string; paint: Gradient }) {
  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1={paint.x1}
      y1={paint.y1}
      x2={paint.x2}
      y2={paint.y2}
    >
      <stop offset="0" stopColor={paint.from} />
      <stop offset="1" stopColor={paint.to} />
    </linearGradient>
  );
}

/**
 * The mark's paths. Gradient ids are per instance: a page can hold several marks, and a
 * reference to a gradient inside a hidden one (the desktop sidebar on a phone) paints nothing.
 */
function MarkArt() {
  const uid = useId().replace(/[^\w-]/g, "");
  const fold = `${uid}-fold`;
  const awning = `${uid}-awning`;
  const stripes = `${uid}-stripes`;
  return (
    <>
      <defs>
        <GradientDef id={fold} paint={markPaint.fold} />
        <GradientDef id={awning} paint={markPaint.awning} />
        <GradientDef id={stripes} paint={markPaint.stripes} />
      </defs>
      <path fill={markPaint.body} d={mark.body} />
      <path fill={`url(#${fold})`} d={mark.fold} />
      <path fill={`url(#${awning})`} d={mark.awning} />
      <path fill={`url(#${stripes})`} d={mark.stripes} />
    </>
  );
}

type LogoMarkProps = Omit<React.ComponentProps<"svg">, "children"> & {
  /** Accessible name. Leave it out when the wordmark or a labelled link already names it. */
  title?: string;
  /**
   * `tile`: the mark on its black rounded tile, like the app icon (any surface).
   * `bare`: the mark alone, for black surfaces such as the brand panel.
   */
  variant?: "tile" | "bare";
};

/** The official TezDukan mark. Its colours are the logo's own and never themed. */
function LogoMark({ className, title, variant = "tile", ...props }: LogoMarkProps) {
  const onTile = variant === "tile";
  return (
    <svg
      viewBox={onTile ? `0 0 ${tile.size} ${tile.size}` : `0 0 ${mark.width} ${mark.height}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", onTile ? "size-10" : "h-10 w-auto", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {onTile ? (
        <>
          <rect width={tile.size} height={tile.size} rx={tile.radius} fill={logoColors.black} />
          <g transform={`translate(${tile.x} ${tile.y})`}>
            <MarkArt />
          </g>
        </>
      ) : (
        <MarkArt />
      )}
    </svg>
  );
}

/**
 * "TezDukan" in the logo's lettering. On light surfaces "Dukan" takes a deeper shade of the
 * logo's mint so it stays readable on white; on dark surfaces it is the logo's own mint.
 */
function Wordmark({
  className,
  tone = "auto",
  ...props
}: Omit<React.ComponentProps<"svg">, "children"> & { tone?: "auto" | "onDark" }) {
  const onDark = tone === "onDark";
  return (
    <svg
      viewBox={`0 0 ${wordmark.width} ${wordmark.height}`}
      role="img"
      aria-label="TezDukan"
      className={cn("h-5 w-auto shrink-0", className)}
      {...props}
    >
      <path d={wordmark.tez} className={onDark ? "fill-on-brand-panel" : "fill-(--wordmark-tez)"} />
      <path
        d={wordmark.dukan}
        fill={onDark ? logoColors.mint : undefined}
        className={onDark ? undefined : "fill-(--wordmark-dukan)"}
      />
    </svg>
  );
}

/** Mark and wordmark side by side. Brand artwork is not mirrored in right-to-left layouts. */
function Logo({
  className,
  markClassName,
  wordmarkClassName,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span dir="ltr" className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <Wordmark className={wordmarkClassName} />
    </span>
  );
}

export { Logo, LogoMark, Wordmark };
