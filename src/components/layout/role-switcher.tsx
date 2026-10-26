"use client";

import { cn } from "cn";
import { Check, Clock3, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { switchContextAction } from "@/features/auth/actions";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRouter } from "@/i18n/navigation";
import { isUsable, type RoleContext, type ShellSession } from "@/lib/auth/session-types";
import { haptic } from "@/lib/haptics";
import { roleIcon } from "./nav-config";

function contextKey(c: Pick<RoleContext, "role" | "contextId">) {
  return `${c.role}:${c.contextId ?? ""}`;
}

/**
 * Lists every role this account holds (customer always, plus each shop / distributor /
 * admin context). Switching updates the active context and moves to that role's home
 * without signing out.
 */
function RoleSwitcherSheet({
  session,
  open,
  onOpenChange,
}: {
  session: ShellSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // A bottom sheet on phones; on desktop, the side panel Munshi uses too.
  const desktop = useMediaQuery("(min-width: 1024px)");
  const t = useTranslations("roles");
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const activeKey = contextKey({ role: session.activeRole, contextId: session.activeContextId });

  const choose = (context: RoleContext) => {
    const key = contextKey(context);
    if (key === activeKey) {
      onOpenChange(false);
      return;
    }
    setPendingKey(key);
    startTransition(async () => {
      const result = await switchContextAction(context.role, context.contextId);
      setPendingKey(null);
      if (!result.ok) {
        toast.error(t("switchFailed"));
        return;
      }
      haptic("success");
      onOpenChange(false);
      toast.success(t("switched", { role: t(context.role) }));
      router.push(result.data.home);
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={desktop ? "end" : "bottom"} aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{t("switchTitle")}</SheetTitle>
          <SheetDescription>{t("switchDescription")}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <ul className="flex flex-col gap-2">
            {session.contexts.map((context) => {
              const key = contextKey(context);
              const active = key === activeKey;
              const usable = isUsable(context);
              const Icon = roleIcon[context.role];
              return (
                <li key={key}>
                  <button
                    type="button"
                    disabled={!usable || pendingKey !== null}
                    onClick={() => choose(context)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex min-h-16 w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors",
                      active
                        ? "border-primary bg-primary-soft"
                        : "border-border bg-surface hover:bg-subtle",
                      !usable && "cursor-not-allowed opacity-70 hover:bg-surface",
                    )}
                  >
                    {context.name ? (
                      <Avatar className="size-11 rounded-md">
                        {context.imageUrl ? <AvatarImage src={context.imageUrl} alt="" /> : null}
                        <AvatarFallback name={context.name} className="rounded-md" />
                      </Avatar>
                    ) : (
                      <span className="flex size-11 items-center justify-center rounded-md bg-subtle text-ink">
                        <Icon aria-hidden className="size-5" />
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-base font-semibold text-ink">
                        {context.name ?? t(context.role)}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-muted">
                        {context.name ? t(context.role) : null}
                        {context.status === "pending" ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-awning-ink">
                            <Clock3 aria-hidden className="size-3.5" />
                            {t("awaitingApproval")}
                          </span>
                        ) : null}
                        {context.status === "rejected" ? (
                          <span className="font-semibold text-danger-ink">{t("rejected")}</span>
                        ) : null}
                      </span>
                    </span>
                    {pendingKey === key ? (
                      <LoaderCircle aria-hidden className="size-5 animate-spin text-muted" />
                    ) : active ? (
                      <span className="flex items-center gap-1 text-sm font-semibold text-primary-strong">
                        <Check aria-hidden className="size-5" />
                        <span className="sr-only">{t("current")}</span>
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

export { RoleSwitcherSheet };
