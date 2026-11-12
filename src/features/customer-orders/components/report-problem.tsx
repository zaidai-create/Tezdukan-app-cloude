"use client";

import { cn } from "cn";
import {
  CircleHelp,
  Clock3,
  MessageCircle,
  PackageMinus,
  PackageX,
  Replace,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Link } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { reportOrderProblem } from "../actions";
import { type ProblemReason, problemReasons } from "../schemas";

const reasonIcon: Record<ProblemReason, LucideIcon> = {
  missing_item: PackageMinus,
  damaged: PackageX,
  wrong_item: Replace,
  late: Clock3,
  other: CircleHelp,
};

/**
 * "Report a problem": pick what went wrong (one tap), add a few words if needed, send. It goes
 * to the TezDukan team's support chat and to the dukan. Once sent, the card says so and opens
 * the chat instead.
 */
export function ReportProblem({ orderId, reported }: { orderId: string; reported: boolean }) {
  const t = useTranslations("customerOrders.problem");
  const [open, setOpen] = useState(false);

  if (reported) {
    return (
      <section className="flex items-center gap-3 rounded-lg border border-awning/40 bg-awning-soft p-4">
        <ShieldAlert aria-hidden className="size-6 shrink-0 text-awning-ink" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{t("reported")}</p>
          <p className="text-sm text-muted">{t("reportedHint")}</p>
        </div>
        <Link
          href="/account/support"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <MessageCircle aria-hidden />
          {t("openChat")}
        </Link>
      </section>
    );
  }

  return (
    <>
      <Button variant="ghost" block onClick={() => setOpen(true)}>
        <ShieldAlert aria-hidden />
        {t("button")}
      </Button>
      <ReportProblemSheet orderId={orderId} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** The sheet itself, also opened from the order's ⋮ menu. */
export function ReportProblemSheet({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("customerOrders.problem");
  const tErrors = useTranslations("customerOrders.errors");
  const [reason, setReason] = useState<ProblemReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();

  const send = () => {
    if (!reason) return;
    startTransition(async () => {
      const result = await reportOrderProblem(orderId, reason, details);
      if (!result.ok) {
        haptic("warning");
        toast.error(tErrors(result.error));
        return;
      }
      haptic("success");
      toast.success(t("sent"));
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("hint")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-3">
          <div role="radiogroup" aria-label={t("title")} className="flex flex-col gap-2">
            {problemReasons.map((option) => {
              const Icon = reasonIcon[option];
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
                    "flex min-h-14 items-center gap-3 rounded-xl border-[1.5px] px-3.5 text-start font-semibold transition-colors duration-150",
                    on
                      ? "border-primary bg-primary-soft text-primary-strong"
                      : "border-border bg-surface text-ink",
                  )}
                >
                  <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
                  {t(`reasons.${option}`)}
                </button>
              );
            })}
          </div>
          <Textarea
            value={details}
            onChange={(event) => setDetails(event.target.value.slice(0, 1000))}
            placeholder={reason === "other" ? t("detailsRequired") : t("details")}
            aria-label={t("details")}
            className="min-h-24"
          />
        </SheetBody>
        <SheetFooter>
          <Button
            size="lg"
            block
            loading={pending}
            disabled={!reason || (reason === "other" && details.trim().length === 0)}
            onClick={send}
          >
            {t("send")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
