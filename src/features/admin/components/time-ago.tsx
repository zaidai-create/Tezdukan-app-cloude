"use client";

import { useRelativeTime } from "@/hooks/use-relative-time";

/** "5 minutes ago" inside server-rendered lists. */
export function TimeAgo({ value }: { value: string }) {
  const ago = useRelativeTime(value);
  return <time dateTime={value}>{ago}</time>;
}
