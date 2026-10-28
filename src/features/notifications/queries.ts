"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  NOTIFICATION_COLUMNS,
  notificationSchema,
  scopeColumn,
  type AppNotification,
  type NotificationScope,
} from "./schemas";

/** Client data hooks for the notification centre (RLS: a person only reads their own). */

export const notificationsKey = (scope: NotificationScope) =>
  ["notifications", scope.userId, scope.role, scope.contextId] as const;
export const unreadKey = (scope: NotificationScope) =>
  ["notifications", scope.userId, scope.role, scope.contextId, "unread"] as const;

type Filterable<Q> = {
  eq(column: string, value: string): Q;
  is(column: string, value: null): Q;
};

function scoped<Q extends Filterable<Q>>(query: Q, scope: NotificationScope): Q {
  const column = scopeColumn(scope);
  if (column) return scope.contextId ? query.eq(column, scope.contextId) : query;
  return query.is("shop_id", null).is("org_id", null);
}

export function useNotifications(scope: NotificationScope, enabled: boolean) {
  return useQuery({
    queryKey: notificationsKey(scope),
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<AppNotification[]> => {
      const query = getSupabaseBrowserClient()
        .from("notifications")
        .select(NOTIFICATION_COLUMNS)
        .eq("user_id", scope.userId)
        .order("created_at", { ascending: false })
        .limit(50);
      const { data, error } = await scoped(query, scope);
      if (error) throw new Error(error.message);
      return z.array(notificationSchema).parse(data);
    },
  });
}

export function useUnreadNotifications(scope: NotificationScope) {
  return useQuery({
    queryKey: unreadKey(scope),
    staleTime: 30_000,
    queryFn: async (): Promise<number> => {
      const query = getSupabaseBrowserClient()
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", scope.userId)
        .is("read_at", null);
      const { count, error } = await scoped(query, scope);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}

/** Marks some notifications (or every unread one in scope) read, instantly in the UI. */
export function useMarkNotificationsRead(scope: NotificationScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[] | "all") => {
      let query = getSupabaseBrowserClient()
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", scope.userId)
        .is("read_at", null);
      if (ids !== "all") query = query.in("id", ids);
      const { error } = await scoped(query, scope);
      if (error) throw new Error(error.message);
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: notificationsKey(scope) });
      const now = new Date().toISOString();
      const previous = queryClient.getQueryData<AppNotification[]>(notificationsKey(scope));
      const previousUnread = queryClient.getQueryData<number>(unreadKey(scope));
      if (previous) {
        queryClient.setQueryData(
          notificationsKey(scope),
          previous.map((n) =>
            n.read_at === null && (ids === "all" || ids.includes(n.id))
              ? { ...n, read_at: now }
              : n,
          ),
        );
      }
      if (previousUnread !== undefined) {
        const marked =
          ids === "all"
            ? previousUnread
            : (previous ?? []).filter((n) => n.read_at === null && ids.includes(n.id)).length;
        queryClient.setQueryData(unreadKey(scope), Math.max(0, previousUnread - marked));
      }
      return { previous, previousUnread };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(notificationsKey(scope), context.previous);
      if (context?.previousUnread !== undefined)
        queryClient.setQueryData(unreadKey(scope), context.previousUnread);
    },
  });
}
