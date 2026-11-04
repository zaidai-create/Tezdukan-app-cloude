"use client";

import { Check, Loader2, Pause, Play, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { haptic } from "@/lib/haptics";
import { type AdminResult, decide, setActive, type Target } from "../actions";

type Pending = "reject" | "pause" | null;

const primary =
  "sheen flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-action px-4 font-semibold text-on-action shadow-glow inset-shadow-edge disabled:opacity-60";
const secondary =
  "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-subtle px-4 font-semibold text-ink disabled:opacity-60";
const danger =
  "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-danger-soft px-4 font-semibold text-danger-ink disabled:opacity-60";

/**
 * What an admin can do with a dukan or distributor in its current state: approve or reject
 * one that is waiting, pause an active one, start a paused one again. Rejecting and pausing
 * ask for a reason, which the owner sees.
 */
export function EntityActions({
  target,
  id,
  status,
  onDone,
}: {
  target: Target;
  id: string;
  status: string;
  onDone?: () => void;
}) {
  const t = useTranslations("admin.actions");
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState<Pending>(null);
  const [reason, setReason] = useState("");

  const finish = (result: AdminResult, success: string) => {
    if (!result.ok) {
      haptic("warning");
      toast.error(t(`errors.${result.error}`));
      return;
    }
    haptic("success");
    toast.success(success);
    setAsking(null);
    setReason("");
    onDone?.();
  };

  const act = (kind: "approve" | "reject" | "pause" | "restart") =>
    startTransition(async () => {
      if (kind === "approve") finish(await decide(target, id, true), t("approved"));
      if (kind === "reject") finish(await decide(target, id, false, reason), t("rejected"));
      if (kind === "pause") finish(await setActive(target, id, false, reason), t("paused"));
      if (kind === "restart") finish(await setActive(target, id, true), t("restarted"));
    });

  if (asking) {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">
            {asking === "reject" ? t("rejectReason") : t("pauseReason")}
          </span>
          <Textarea
            value={reason}
            maxLength={300}
            dir="auto"
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("reasonPlaceholder")}
          />
        </label>
        <div className="flex gap-2">
          <button type="button" className={secondary} onClick={() => setAsking(null)}>
            {t("back")}
          </button>
          <button
            type="button"
            className={danger}
            disabled={pending || reason.trim().length < 3}
            onClick={() => act(asking === "reject" ? "reject" : "pause")}
          >
            {pending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : null}
            {asking === "reject" ? t("confirmReject") : t("confirmPause")}
          </button>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex gap-2">
        <button type="button" className={danger} onClick={() => setAsking("reject")}>
          <X aria-hidden className="size-5" strokeWidth={1.75} />
          {t("reject")}
        </button>
        <button type="button" className={primary} disabled={pending} onClick={() => act("approve")}>
          {pending ? (
            <Loader2 aria-hidden className="size-5 animate-spin" />
          ) : (
            <Check aria-hidden className="size-5" strokeWidth={1.75} />
          )}
          {t("approve")}
        </button>
      </div>
    );
  }
  if (status === "approved") {
    return (
      <button type="button" className={danger} onClick={() => setAsking("pause")}>
        <Pause aria-hidden className="size-5" strokeWidth={1.75} />
        {t("pause")}
      </button>
    );
  }
  if (status === "suspended") {
    return (
      <button type="button" className={primary} disabled={pending} onClick={() => act("restart")}>
        {pending ? (
          <Loader2 aria-hidden className="size-5 animate-spin" />
        ) : (
          <Play aria-hidden className="size-5" strokeWidth={1.75} />
        )}
        {t("restart")}
      </button>
    );
  }
  return null;
}
