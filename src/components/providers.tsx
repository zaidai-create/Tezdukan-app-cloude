"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { Direction } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { syncThemeColor } from "@/lib/theme/use-theme";

/**
 * Keeps the browser's bars in the app's theme. The page's theme-color tag is written by the
 * framework in the light colour, again after first paint and on navigation; left alone, dark
 * mode on an iPhone shows a white strip under the navigation dock.
 */
function ThemeColorKeeper() {
  useEffect(() => {
    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["content"],
    });
    return () => observer.disconnect();
  }, []);
  return null;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is pushed over Realtime where freshness matters; avoid refetch storms on 4G.
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}

export function Providers({ children, dir }: { children: ReactNode; dir: "ltr" | "rtl" }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {/* Motion follows the phone's reduce-motion setting, like the CSS animations do. */}
      <MotionConfig reducedMotion="user">
        <Direction.Provider dir={dir}>
          <TooltipProvider>
            <ThemeColorKeeper />
            {children}
            <Toaster dir={dir} />
          </TooltipProvider>
        </Direction.Provider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
