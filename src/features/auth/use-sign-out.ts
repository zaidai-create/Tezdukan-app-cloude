"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { clearPrivateCaches } from "@/lib/pwa/caches";
import { signOutAction } from "./actions";

/**
 * Signs out and forgets this account on the device: cached queries and the screens the
 * service worker kept for offline use.
 */
export function useSignOut() {
  const t = useTranslations("auth.errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingOut, startSignOut] = useTransition();

  const signOut = () =>
    startSignOut(async () => {
      const result = await signOutAction();
      if (!result.ok) {
        toast.error(t("generic"));
        return;
      }
      queryClient.clear();
      await clearPrivateCaches();
      router.replace("/login");
      router.refresh();
    });

  return { signOut, signingOut };
}
