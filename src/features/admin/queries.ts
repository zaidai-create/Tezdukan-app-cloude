"use client";

import { useQuery } from "@tanstack/react-query";
import { getEntityDocuments, type Target } from "./actions";

/** A dukan's or distributor's registration documents, fetched when its sheet opens. */
export function useEntityDocuments(target: Target, id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "documents", target, id],
    queryFn: async () => {
      const result = await getEntityDocuments(target, id);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled,
    // The photo links expire after 10 minutes; fetch fresh ones well before that.
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
  });
}
