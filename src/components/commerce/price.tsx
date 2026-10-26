import { cn } from "cn";
import { formatRs, type Paisa } from "@/lib/money";

type PriceProps = {
  paisa: Paisa;
  /** Struck-through reference price (MRP or regular price). Hidden when not higher. */
  strikePaisa?: Paisa | null;
  strikeLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { price: "text-sm", strike: "text-xs" },
  md: { price: "text-base", strike: "text-xs" },
  lg: { price: "text-2xl", strike: "text-sm" },
} as const;

/** Prices are always LTR digits with tabular figures, even inside Urdu text. */
function Price({ paisa, strikePaisa, strikeLabel, size = "md", className }: PriceProps) {
  const showStrike = strikePaisa != null && strikePaisa > paisa;
  return (
    <span dir="ltr" className={cn("num inline-flex items-baseline gap-1.5", className)}>
      <span className={cn("font-bold text-ink", sizes[size].price)}>{formatRs(paisa)}</span>
      {showStrike ? (
        <s className={cn("text-muted", sizes[size].strike)}>
          {strikeLabel ? <span className="sr-only">{strikeLabel} </span> : null}
          {formatRs(strikePaisa)}
        </s>
      ) : null}
    </span>
  );
}

export { Price };
