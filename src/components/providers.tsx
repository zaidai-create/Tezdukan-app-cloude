"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Direction } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

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
      <Direction.Provider dir={dir}>
        <TooltipProvider>
          {children}
          <Toaster dir={dir} />
        </TooltipProvider>
      </Direction.Provider>
    </QueryClientProvider>
  );
}
