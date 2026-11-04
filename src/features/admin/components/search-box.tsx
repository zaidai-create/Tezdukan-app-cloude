"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Search that lives in the address (?q=), so a filtered list can be shared or refreshed. */
export function SearchBox({ placeholder, label }: { placeholder: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const update = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const query = new URLSearchParams(params.toString());
      if (next.trim()) query.set("q", next.trim());
      else query.delete("q");
      const search = query.toString();
      startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname));
    }, 300);
  };

  return (
    <label className="flex h-12 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 focus-within:ring-2 focus-within:ring-ring">
      <Search aria-hidden className="size-5 shrink-0 text-muted" strokeWidth={1.75} />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => update(event.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
      />
    </label>
  );
}
