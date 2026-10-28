"use client";

import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { activeContextOf, type ShellSession } from "@/lib/auth/session-types";
import { roleIcon } from "./nav-config";
import { RoleSwitcherSheet } from "./role-switcher";

/** Shows who you are acting as (shop / distributor / role) and opens the role switcher. */
function ContextButton({ session, className }: { session: ShellSession; className?: string }) {
  const t = useTranslations("roles");
  const [open, setOpen] = useState(false);
  const active = activeContextOf(session);
  const Icon = roleIcon[session.activeRole];
  const title = active?.name ?? t(session.activeRole);
  const canSwitch = session.contexts.length > 1;

  return (
    <>
      <button
        type="button"
        onClick={() => canSwitch && setOpen(true)}
        disabled={!canSwitch}
        className={cn(
          "flex min-h-12 min-w-0 items-center gap-2.5 rounded-md px-1 text-start disabled:cursor-default",
          canSwitch && "hover:bg-subtle",
          className,
        )}
      >
        {active?.name ? (
          <Avatar className="size-10 rounded-md">
            {active.imageUrl ? <AvatarImage src={active.imageUrl} alt="" /> : null}
            <AvatarFallback name={active.name} className="rounded-md" />
          </Avatar>
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
            <Icon aria-hidden className="size-5" />
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1 truncate font-heading text-base leading-tight font-semibold text-ink">
            <span className="truncate">{title}</span>
            {canSwitch ? <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" /> : null}
          </span>
          {/* Under a shop or company name, say which role it is; on its own the role is the title. */}
          {active?.name ? (
            <span className="truncate text-xs text-muted">{t(session.activeRole)}</span>
          ) : null}
        </span>
        {canSwitch ? <span className="sr-only">{t("switchRole")}</span> : null}
      </button>
      {canSwitch ? (
        <RoleSwitcherSheet session={session} open={open} onOpenChange={setOpen} />
      ) : null}
    </>
  );
}

export { ContextButton };
