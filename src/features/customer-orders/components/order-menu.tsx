"use client";

import { cn } from "cn";
import {
  Ban,
  EllipsisVertical,
  Headset,
  MessageCircle,
  Phone,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { updateCustomerOrderStatus } from "../actions";
import {
  type CancelReason,
  type CancelState,
  cancelReasons,
  cancelStateOf,
} from "../cancel-policy";
import type { CustomerOrder } from "../schemas";
import { ReportProblemSheet } from "./report-problem";

/**
 * The ⋮ button on the customer's order: help, report a problem, call the dukan, and (kept out of
 * the way, as the big delivery apps do) cancel. Cancel follows the policy shown at checkout: free
 * until the dukan accepts, a short window after, then "call the dukan".
 */
export function OrderMenu({
  order,
  callHref,
  reported,
}: {
  order: Pick<CustomerOrder, "id" | "status" | "accepted_at" | "shop_name">;
  callHref: string | null;
  reported: boolean;
}) {
  const t = useTranslations("customerOrders.menu");
  const router = useRouter();
  const [sheet, setSheet] = useState<"cancel" | "problem" | null>(null);
  const [cancel, setCancel] = useState<CancelState>({ kind: "none" });
  const live = !["delivered", "cancelled", "rejected"].includes(order.status);
  const canReport = order.status !== "cancelled" && order.status !== "rejected";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("label")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border/60 bg-surface text-ink shadow-card transition-transform duration-150 active:scale-95"
        >
          <EllipsisVertical aria-hidden className="size-5" strokeWidth={1.75} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push("/account/support")}>
            <Headset aria-hidden strokeWidth={1.75} />
            {t("help")}
          </DropdownMenuItem>
          {canReport ? (
            reported ? (
              <DropdownMenuItem onSelect={() => router.push("/account/support")}>
                <MessageCircle aria-hidden strokeWidth={1.75} />
                {t("problemOpen")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setSheet("problem")}>
                <ShieldAlert aria-hidden strokeWidth={1.75} />
                {t("problem")}
              </DropdownMenuItem>
            )
          ) : null}
          {callHref ? (
            <DropdownMenuItem asChild>
              <a href={callHref}>
                <Phone aria-hidden strokeWidth={1.75} />
                {t("callShop")}
              </a>
            </DropdownMenuItem>
          ) : null}
          {live ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="danger"
                onSelect={() => {
                  // Read the clock when asked, so the sheet shows the rule as it is right now.
                  setCancel(cancelStateOf(order, Date.now()));
                  setSheet("cancel");
                }}
              >
                <Ban aria-hidden strokeWidth={1.75} />
                {t("cancel")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canReport && !reported ? (
        <ReportProblemSheet
          orderId={order.id}
          open={sheet === "problem"}
          onOpenChange={(open) => setSheet(open ? "problem" : null)}
        />
      ) : null}
      <CancelSheet
        orderId={order.id}
        open={sheet === "cancel"}
        state={cancel}
        onTimeUp={() => setCancel({ kind: "too_late" })}
        onOpenChange={(open) => setSheet(open ? "cancel" : null)}
        callHref={callHref}
      />
    </>
  );
}

function CancelSheet({
  orderId,
  open,
  state,
  onTimeUp,
  onOpenChange,
  callHref,
}: {
  orderId: string;
  open: boolean;
  state: CancelState;
  onTimeUp: () => void;
  onOpenChange: (open: boolean) => void;
  callHref: string | null;
}) {
  const t = useTranslations("customerOrders.cancel");
  const tErrors = useTranslations("customerOrders.errors");
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();
  const left = useSecondsLeft(open && state.kind === "grace" ? state.endsAt : null, onTimeUp);

  const confirm = () => {
    if (!reason) return;
    const said = [t(`reasons.${reason}`), details.trim()].filter(Boolean).join(": ");
    startTransition(async () => {
      const result = await updateCustomerOrderStatus(orderId, "cancelled", said);
      if (!result.ok) {
        haptic("warning");
        if (result.error === "too_late_to_cancel") onTimeUp();
        toast.error(tErrors(result.error));
        return;
      }
      haptic("success");
      toast.success(t("done"));
      onOpenChange(false);
    });
  };

  const tooLate = state.kind === "too_late";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{tooLate ? t("tooLateTitle") : t("title")}</SheetTitle>
          <SheetDescription>
            {tooLate ? t("tooLateHint") : state.kind === "grace" ? t("graceHint") : t("freeHint")}
          </SheetDescription>
        </SheetHeader>
        {tooLate ? (
          <SheetFooter className="flex flex-col gap-2">
            {callHref ? (
              <a href={callHref} className={buttonVariants({ size: "lg", block: true })}>
                <Phone aria-hidden />
                {t("callShop")}
              </a>
            ) : null}
            <Link
              href="/account/support"
              className={buttonVariants({ variant: "secondary", size: "lg", block: true })}
            >
              <Headset aria-hidden />
              {t("askHelp")}
            </Link>
          </SheetFooter>
        ) : (
          <>
            <SheetBody className="flex flex-col gap-3">
              {left !== null ? (
                <p
                  role="timer"
                  className="num flex items-center gap-2 rounded-md bg-awning-soft px-3 py-2.5 text-sm font-semibold text-awning-ink"
                >
                  <Timer aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
                  {t("timeLeft", { time: clock(left) })}
                </p>
              ) : null}
              <h3 className="font-heading text-base font-bold text-ink">{t("reasonTitle")}</h3>
              <div role="radiogroup" aria-label={t("reasonTitle")} className="flex flex-col gap-2">
                {cancelReasons.map((option) => {
                  const on = reason === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        haptic("tap");
                        setReason(option);
                      }}
                      className={cn(
                        "flex min-h-12 items-center rounded-xl border-[1.5px] px-3.5 text-start font-semibold transition-colors duration-150",
                        on
                          ? "border-danger bg-danger-soft text-danger-ink"
                          : "border-border bg-surface text-ink",
                      )}
                    >
                      {t(`reasons.${option}`)}
                    </button>
                  );
                })}
              </div>
              {reason === "other" ? (
                <Textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value.slice(0, 150))}
                  placeholder={t("detailsPlaceholder")}
                  aria-label={t("detailsPlaceholder")}
                  className="min-h-20"
                />
              ) : null}
            </SheetBody>
            <SheetFooter className="flex flex-col gap-2">
              <Button
                variant="danger"
                size="lg"
                block
                loading={pending}
                disabled={!reason}
                onClick={confirm}
              >
                {t("confirm")}
              </Button>
              <Button variant="secondary" size="lg" block onClick={() => onOpenChange(false)}>
                {t("keep")}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Seconds until `endsAt`, ticking once a second; calls `onEnd` when it reaches zero. */
function useSecondsLeft(endsAt: number | null, onEnd: () => void): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) onEnd();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt, onEnd]);
  if (endsAt === null) return null;
  return Math.max(Math.ceil((endsAt - now) / 1000), 0);
}

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
