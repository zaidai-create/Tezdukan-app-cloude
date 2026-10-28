"use client";

import { useFormatter, useNow } from "next-intl";
import { useSyncExternalStore } from "react";
import { formatDateTime } from "@/lib/format";

const noop = () => () => {};

/**
 * "2 minutes ago", kept fresh. The server and the first client render show the exact time
 * instead: "now" differs between the two, and relative text would not hydrate.
 */
export function useRelativeTime(value: string | Date | null): string {
  const format = useFormatter();
  const now = useNow({ updateInterval: 30_000 });
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (value === null) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return hydrated ? format.relativeTime(date, now) : `⁦${formatDateTime(date)}⁩`;
}
