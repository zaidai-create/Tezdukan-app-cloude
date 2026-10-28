"use client";

import { cn } from "cn";

/** One choice from a few short options (reasons, ratings): capsule radio buttons. */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  label,
  render,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  render: (value: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "relative inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors after:absolute after:inset-x-0 after:-inset-y-1",
            value === option
              ? "border-primary bg-primary-soft text-primary-strong"
              : "border-border bg-surface text-ink",
          )}
        >
          {render(option)}
        </button>
      ))}
    </div>
  );
}
