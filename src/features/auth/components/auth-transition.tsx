"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/**
 * Moving between sign in, sign up and password reset replays a short rise, so the swap reads as
 * one motion. Changing language keeps the path, so it does not replay.
 */
function AuthTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="flex animate-rise flex-col">
      {children}
    </div>
  );
}

export { AuthTransition };
