"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { haptic } from "@/lib/haptics";
import { setFlag } from "../actions";

/** One of the app's switches. Saved at once; the change is recorded in the audit log. */
export function FlagToggle({
  flagKey,
  enabled,
  label,
  disabled,
}: {
  flagKey: string;
  enabled: boolean;
  label: string;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.actions");
  const [, startTransition] = useTransition();
  const [on, setOn] = useOptimistic(enabled);
  return (
    <Switch
      checked={on}
      disabled={disabled}
      aria-label={label}
      onCheckedChange={(next) =>
        startTransition(async () => {
          setOn(next);
          const result = await setFlag(flagKey, next);
          if (!result.ok) {
            haptic("warning");
            toast.error(t(`errors.${result.error}`));
            return;
          }
          haptic("tap");
          toast.success(t("saved"));
        })
      }
    />
  );
}
