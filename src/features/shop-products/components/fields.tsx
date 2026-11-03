"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { paisaToRupees } from "@/lib/money";

/** Rupees typed as text ("1,250"); parse with parseRupees when saving. */
export function rupeesText(paisa: number | null | undefined): string {
  return paisa ? String(paisaToRupees(paisa)) : "";
}

export function PriceField({
  value,
  onChange,
  label,
  invalid,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon className="pe-1 font-semibold text-ink">{"Rs"}</InputGroupAddon>
      <InputGroupInput
        inputMode="decimal"
        dir="ltr"
        className="num ps-1"
        value={value}
        aria-label={label}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ""))}
      />
    </InputGroup>
  );
}

/** A capsule − n + stepper with a typeable middle, for stock counts. */
export function QtyField({
  value,
  onChange,
  label,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  step?: number;
}) {
  const t = useTranslations("shopProducts");
  const set = (next: number) => onChange(Math.max(0, Math.min(100_000, Math.round(next))));
  return (
    <div className="flex h-12 items-center rounded-full border border-border-strong bg-surface">
      <button
        type="button"
        onClick={() => set(value - step)}
        aria-label={t("less", { name: label })}
        className="flex size-12 items-center justify-center rounded-full text-primary-strong active:scale-95"
      >
        <Minus aria-hidden className="size-5" />
      </button>
      <input
        inputMode="numeric"
        dir="ltr"
        aria-label={label}
        className="num h-full w-16 min-w-0 flex-1 bg-transparent text-center text-lg font-bold text-ink outline-none"
        value={String(value)}
        onChange={(event) => set(Number(event.target.value.replace(/\D/g, "") || 0))}
      />
      <button
        type="button"
        onClick={() => set(value + step)}
        aria-label={t("more", { name: label })}
        className="flex size-12 items-center justify-center rounded-full text-primary-strong active:scale-95"
      >
        <Plus aria-hidden className="size-5" />
      </button>
    </div>
  );
}
