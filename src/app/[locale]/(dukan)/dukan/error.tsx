"use client";

import { ErrorState } from "@/components/states/error-state";

/** Any dukandar screen that fails to load shows this, with Retry. */
export default function DukanError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState onRetry={reset} className="py-16" />;
}
