import { cn } from "cn";
import { useId } from "react";

type AwningProps = {
  className?: string;
  /** Height of the striped band in px (the scallops add half a stripe below it). */
  height?: number;
  /** Width of one stripe in px. */
  stripe?: number;
};

/**
 * The scalloped, striped shop awning from the logo (amber with orange stripes): a TezDukan
 * signature. Use at most once per screen: storefront headers, onboarding, order success and
 * empty states. It tiles to any width, so it can span a header edge to edge. As in the logo,
 * the orange stripes hang a little shorter than the amber ones.
 */
function Awning({ className, height = 20, stripe = 22 }: AwningProps) {
  const id = useId().replace(/[^\w-]/g, "");
  const radius = stripe / 2;
  const total = height + radius;
  const tile = stripe * 2;
  return (
    <svg aria-hidden className={cn("block w-full", className)} height={total} data-slot="awning">
      <defs>
        <pattern id={`awning-${id}`} width={tile} height={total} patternUnits="userSpaceOnUse">
          <rect x={0} y={0} width={stripe} height={height} className="fill-awning" />
          <rect x={stripe} y={0} width={stripe} height={height} className="fill-awning-deep" />
          <path
            d={`M0 ${height}h${stripe}v0a${radius} ${radius} 0 0 1-${stripe} 0Z`}
            className="fill-awning"
          />
          <path
            d={`M${stripe} ${height}h${stripe}v0a${radius} ${radius * 0.7} 0 0 1-${stripe} 0Z`}
            className="fill-awning-deep"
          />
        </pattern>
        <filter id={`awning-shadow-${id}`} x="-5%" y="-5%" width="110%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.12" />
        </filter>
      </defs>
      <rect
        width="100%"
        height={total}
        fill={`url(#awning-${id})`}
        filter={`url(#awning-shadow-${id})`}
      />
    </svg>
  );
}

export { Awning };
