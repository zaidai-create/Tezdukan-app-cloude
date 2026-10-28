"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { haptic } from "@/lib/haptics";
import { setProductActive } from "../actions";

/** Show or hide a product from dukans, instantly, with Undo. */
export function ActiveSwitch({ id, name, active }: { id: string; name: string; active: boolean }) {
  const t = useTranslations("catalog");
  const tCommon = useTranslations("common");
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [, startTransition] = useTransition();

  const change = (next: boolean) =>
    startTransition(async () => {
      setOptimistic(next);
      haptic("tap");
      const result = await setProductActive(id, next);
      if (!result.ok) {
        toast.error(t(`form.errors.${result.error}`));
        return;
      }
      toast(next ? t("shown", { name }) : t("hiddenToast", { name }), {
        action: { label: tCommon("undo"), onClick: () => change(!next) },
      });
    });

  return (
    <Switch
      checked={optimistic}
      onCheckedChange={change}
      aria-label={`${t("showInShop")}: ${name}`}
    />
  );
}
