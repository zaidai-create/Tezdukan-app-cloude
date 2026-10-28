"use client";

import { ErrorState } from "@/components/states/error-state";

/** Any distributor screen that fails to load shows this, with Retry. */
export default function DistributorError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState onRetry={reset} className="py-16" />;
}
