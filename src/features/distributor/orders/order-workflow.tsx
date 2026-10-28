"use client";

import {
  CircleCheck,
  KeyRound,
  Minus,
  PackageCheck,
  Phone,
  PhoneCall,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useContext, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Textarea } from "@/components/ui/textarea";
import { useRelativeTime } from "@/hooks/use-relative-time";
import { haptic } from "@/lib/haptics";
import { telHref } from "@/lib/contact";
import { formatRs, parseRupees } from "@/lib/money";
import type { OrderStatus } from "@/features/ordering/schemas";
import {
  cancelAsDistributor,
  confirmDelivery,
  requestShopConfirmation,
  updateOrderStatus,
} from "../actions";
import type { DistributorErrorKey } from "../errors";
import type { ConfirmationReason } from "../schemas";

export type WorkflowOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: string;
  totalPaisa: number;
  paidPaisa: number;
  needsConfirmation: boolean;
  reasons: ConfirmationReason[];
  thresholdPaisa: number;
  phoneConfirmedAt: string | null;
  shopConfirmedAt: string | null;
  shopConfirmRequestedAt: string | null;
};
export type WorkflowShop = { name: string; contactName: string; phone: string | null };
export type WorkflowItem = {
  id: string;
  name: string;
  baseQty: number;
  piecePricePaisa: number;
  freeBaseQty: number;
};

const rejectReasons = ["stock", "area", "credit", "closed", "other"] as const;
type RejectReason = (typeof rejectReasons)[number];

function useErrorToast() {
  const t = useTranslations("distributor.errors");
  return (error: DistributorErrorKey) => {
    haptic("warning");
    toast.error(t(error));
  };
}

/** The "big order" step: call or ask in the app, then tick that the dukandar confirmed. */
function ConfirmationPanel({
  order,
  shop,
  phoneConfirmed,
  onPhoneConfirmed,
}: {
  order: WorkflowOrder;
  shop: WorkflowShop;
  phoneConfirmed: boolean;
  onPhoneConfirmed: (value: boolean) => void;
}) {
  const t = useTranslations("distributor.order.confirm");
  const confirmedAgo = useRelativeTime(order.shopConfirmedAt);
  const askedAgo = useRelativeTime(order.shopConfirmRequestedAt);
  const showError = useErrorToast();
  const [pending, startTransition] = useTransition();
  const tel = telHref(shop.phone);
  const threshold = formatRs(order.thresholdPaisa);

  if (order.shopConfirmedAt) {
    return (
      <section className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft p-4">
        <ShieldCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-primary-strong" />
        <p className="font-semibold text-primary-strong">
          {t("shopConfirmed", { name: shop.contactName, time: confirmedAgo })}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-awning/60 bg-awning-soft p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-awning text-on-awning">
          <PhoneCall aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-bold text-awning-ink">{t("title")}</h2>
          <p className="mt-0.5 text-sm text-ink">{t("body", { threshold })}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {order.reasons.map((reason) => (
              <li
                key={reason}
                className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink"
              >
                {reason === "first_order" ? (
                  <Sparkles aria-hidden className="size-3.5" />
                ) : (
                  <CircleCheck aria-hidden className="size-3.5" />
                )}
                {t(`reasons.${reason}`, { threshold })}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {tel ? (
          <a
            href={tel}
            className="sheen flex h-12 items-center justify-center gap-2 rounded-md bg-action px-4 text-sm font-semibold text-on-action shadow-glow inset-shadow-edge"
          >
            <Phone aria-hidden className="size-5" />
            <span className="truncate">{t("callNow", { name: shop.contactName })}</span>
          </a>
        ) : null}
        <Button
          variant="secondary"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await requestShopConfirmation(order.id);
              if (!result.ok) return showError(result.error);
              haptic("success");
              toast.success(t("askedToast"));
            })
          }
        >
          <Send aria-hidden />
          {t("askInApp")}
        </Button>
      </div>
      {order.shopConfirmRequestedAt ? (
        <p className="text-sm text-ink">{t("asked", { time: askedAgo })}</p>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-md bg-surface p-3">
        <Checkbox
          checked={phoneConfirmed}
          onCheckedChange={(value) => onPhoneConfirmed(value === true)}
          className="mt-0.5"
        />
        <span className="text-sm font-semibold text-ink">
          {t("checkbox", { name: shop.contactName })}
        </span>
      </label>
    </section>
  );
}

function RejectSheet({
  order,
  open,
  onOpenChange,
}: {
  order: WorkflowOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("distributor.order.reject");
  const showError = useErrorToast();
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [other, setOther] = useState("");
  const [pending, startTransition] = useTransition();
  const isNew = order.status === "new";
  const text = reason === "other" ? other.trim() : reason ? t(`reasons.${reason}`) : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isNew ? t("title") : t("cancelTitle")}</SheetTitle>
          <SheetDescription>{t("body")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-4">
          <ChoiceChips
            options={rejectReasons}
            value={reason}
            onChange={setReason}
            label={t("reasonLabel")}
            render={(value) => t(`reasons.${value}`)}
          />
          {reason === "other" ? (
            <Textarea
              value={other}
              onChange={(event) => setOther(event.target.value)}
              placeholder={t("otherPlaceholder")}
              maxLength={500}
              aria-label={t("reasonLabel")}
            />
          ) : null}
        </SheetBody>
        <SheetFooter>
          <Button
            variant="danger"
            block
            size="lg"
            disabled={!text}
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await cancelAsDistributor({ orderId: order.id, reason: text });
                if (!result.ok) return showError(result.error);
                haptic("success");
                toast.success(t("done"));
                onOpenChange(false);
              })
            }
          >
            {isNew ? t("submit") : t("submitCancel")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DeliverSheet({
  order,
  items,
  open,
  onOpenChange,
}: {
  order: WorkflowOrder;
  items: WorkflowItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("distributor.order.deliver");
  const showError = useErrorToast();
  const [otp, setOtp] = useState("");
  const [editing, setEditing] = useState(false);
  const [delivered, setDelivered] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();
  const [otpError, setOtpError] = useState<string | null>(null);

  const qty = (item: WorkflowItem) => delivered[item.id] ?? item.baseQty;
  const changed = items.filter((item) => item.baseQty > 0 && qty(item) !== item.baseQty);
  // What the dukandar owes for what actually arrives (scheme discounts settle on the server).
  const shortValue = changed.reduce(
    (sum, item) => sum + (item.baseQty - qty(item)) * item.piecePricePaisa,
    0,
  );
  const due = Math.max(0, order.totalPaisa - shortValue - order.paidPaisa);
  const cashDefault = order.paymentMethod === "cod" ? due : 0;
  const [cash, setCash] = useState<string | null>(null);
  const cashPaisa = cash === null ? cashDefault : (parseRupees(cash) ?? -1);

  const submit = () =>
    startTransition(async () => {
      setOtpError(null);
      const result = await confirmDelivery({
        orderId: order.id,
        otp,
        cashPaisa: Math.min(cashPaisa, due),
        lines: changed.map((item) => ({ orderItemId: item.id, deliveredBaseQty: qty(item) })),
      });
      if (!result.ok) return showError(result.error);
      if (!result.data.ok) {
        haptic("warning");
        setOtp("");
        setOtpError(
          result.data.error === "otp_locked"
            ? t("otpLocked")
            : t("otpInvalid", { count: result.data.attempts_left }),
        );
        return;
      }
      haptic("success");
      toast.success(t("success", { invoice: result.data.invoice_number }));
      onOpenChange(false);
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="num">{t("title", { number: order.orderNumber })}</SheetTitle>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <p id="otp-label" className="flex items-center gap-2 font-semibold text-ink">
              <KeyRound aria-hidden className="size-5 text-primary-strong" />
              {t("otpLabel")}
            </p>
            <InputOTP
              maxLength={4}
              value={otp}
              onChange={(value) => setOtp(value.replace(/\D/g, ""))}
              aria-labelledby="otp-label"
              pattern="^[0-9]*$"
            >
              <InputOTPGroup>
                {[0, 1, 2, 3].map((index) => (
                  <InputOTPSlot key={index} index={index} className="size-14 text-2xl" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {otpError ? (
              <p role="alert" className="text-sm font-semibold text-danger-ink">
                {otpError}
              </p>
            ) : (
              <p className="text-sm text-muted">{t("otpHint")}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cash" className="font-semibold text-ink">
              {t("cash")}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted">
                {"Rs"}
              </span>
              <input
                id="cash"
                inputMode="decimal"
                dir="ltr"
                value={cash ?? String(cashDefault / 100)}
                onChange={(event) => setCash(event.target.value)}
                className="num h-12 w-full rounded-md border border-border bg-surface ps-11 pe-4 text-base text-ink outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring"
              />
            </div>
            <p className="num text-sm text-muted">{t("cashHint", { due: formatRs(due) })}</p>
          </div>

          <div className="rounded-lg border border-border/70">
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              aria-expanded={editing}
              className="flex h-12 w-full items-center justify-between px-4 text-sm font-semibold text-ink"
            >
              {t("editQuantities")}
              <span className="text-primary-strong">{editing ? t("doneEditing") : null}</span>
            </button>
            {editing ? (
              <ul className="divide-y divide-border/70 border-t border-border/70">
                {items
                  .filter((item) => item.baseQty > 0)
                  .map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 text-sm text-ink">{item.name}</span>
                      <div className="flex items-center gap-1 rounded-full bg-subtle p-1" dir="ltr">
                        <button
                          type="button"
                          aria-label="-1"
                          disabled={qty(item) <= 0}
                          onClick={() =>
                            setDelivered((d) => ({ ...d, [item.id]: Math.max(0, qty(item) - 1) }))
                          }
                          className="flex size-9 items-center justify-center rounded-full bg-surface text-ink disabled:opacity-40"
                        >
                          <Minus aria-hidden className="size-4" />
                        </button>
                        <span className="num w-14 text-center text-sm font-bold text-ink">
                          {qty(item)}/{item.baseQty}
                        </span>
                        <button
                          type="button"
                          aria-label="+1"
                          disabled={qty(item) >= item.baseQty}
                          onClick={() =>
                            setDelivered((d) => ({
                              ...d,
                              [item.id]: Math.min(item.baseQty, qty(item) + 1),
                            }))
                          }
                          className="flex size-9 items-center justify-center rounded-full bg-surface text-ink disabled:opacity-40"
                        >
                          <Plus aria-hidden className="size-4" />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        </SheetBody>
        <SheetFooter>
          <Button
            block
            size="lg"
            disabled={otp.length !== 4 || cashPaisa < 0}
            loading={pending}
            onClick={submit}
          >
            <PackageCheck aria-hidden />
            {t("submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

type WorkflowContextValue = {
  order: WorkflowOrder;
  shop: WorkflowShop;
  items: WorkflowItem[];
  canManage: boolean;
  canDeliver: boolean;
  phoneConfirmed: boolean;
  setPhoneConfirmed: (value: boolean) => void;
};
const WorkflowContext = createContext<WorkflowContextValue | null>(null);

function useWorkflow() {
  const value = useContext(WorkflowContext);
  if (!value) throw new Error("Order workflow parts must be inside <OrderWorkflow>");
  return value;
}

const awaitingCall = (order: WorkflowOrder) =>
  order.status === "new" &&
  order.needsConfirmation &&
  !order.phoneConfirmedAt &&
  !order.shopConfirmedAt;

/**
 * Everything the distributor does with one order. The page places the confirmation step near
 * the top and the action bar at the end (it sticks above the nav dock); both share whether the
 * dukandar confirmed on a call.
 */
export function OrderWorkflow({
  children,
  ...value
}: Omit<WorkflowContextValue, "phoneConfirmed" | "setPhoneConfirmed"> & { children: ReactNode }) {
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);
  return (
    <WorkflowContext.Provider value={{ ...value, phoneConfirmed, setPhoneConfirmed }}>
      {children}
    </WorkflowContext.Provider>
  );
}

/** The big-order step, shown only while a new order needs (or got) the dukandar's word. */
export function OrderConfirmation() {
  const { order, shop, canManage, phoneConfirmed, setPhoneConfirmed } = useWorkflow();
  if (order.status !== "new" || !order.needsConfirmation || !canManage) return null;
  return (
    <ConfirmationPanel
      order={order}
      shop={shop}
      phoneConfirmed={phoneConfirmed}
      onPhoneConfirmed={setPhoneConfirmed}
    />
  );
}

/** The next step for this order (confirm, pack, dispatch, deliver) and reject/cancel. */
export function OrderActionBar() {
  const { order, items, canManage, canDeliver, phoneConfirmed } = useWorkflow();
  const t = useTranslations("distributor.order.actions");
  const showError = useErrorToast();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingStep, setPendingStep] = useState<string | null>(null);
  const waiting = awaitingCall(order);
  const open = ["new", "confirmed", "picking", "packed", "dispatched"].includes(order.status);

  const move = (to: "confirmed" | "packed" | "dispatched") => {
    setPendingStep(to);
    startTransition(async () => {
      const result = await updateOrderStatus({
        orderId: order.id,
        to,
        phoneConfirmed: to === "confirmed" && waiting ? phoneConfirmed : undefined,
      });
      setPendingStep(null);
      if (!result.ok) return showError(result.error);
      haptic("success");
      const short = result.data.shortages;
      toast.success(
        t(to === "confirmed" ? "confirmed" : to === "packed" ? "packed" : "dispatched"),
        {
          description: short.length
            ? t("shortages", { items: short.map((s) => `${s.name} (${s.short})`).join(", ") })
            : undefined,
        },
      );
    });
  };

  if (!open || !(canManage || canDeliver)) return null;

  return (
    <>
      <StickyActionBar className="flex flex-col gap-1.5">
        {order.status === "new" ? (
          canManage ? (
            <div className="flex gap-1.5">
              <Button
                variant="danger-soft"
                size="lg"
                className="shrink-0 px-4"
                onClick={() => setRejectOpen(true)}
              >
                <X aria-hidden />
                {t("reject")}
              </Button>
              <Button
                size="lg"
                className="min-w-0 flex-1"
                disabled={waiting && !phoneConfirmed}
                loading={pending && pendingStep === "confirmed"}
                onClick={() => move("confirmed")}
              >
                <CircleCheck aria-hidden />
                <span className="truncate">{t("confirm")}</span>
              </Button>
            </div>
          ) : null
        ) : order.status === "dispatched" ? (
          canDeliver ? (
            <Button size="lg" block onClick={() => setDeliverOpen(true)}>
              <PackageCheck aria-hidden />
              {t("deliver")}
            </Button>
          ) : null
        ) : canManage ? (
          <>
            <Button
              size="lg"
              block
              loading={pending && pendingStep === "dispatched"}
              onClick={() => move("dispatched")}
            >
              <Truck aria-hidden />
              {t("dispatch")}
            </Button>
            <div className="flex gap-1.5">
              <Button
                variant="danger-soft"
                className="min-w-0 flex-1"
                onClick={() => setRejectOpen(true)}
              >
                <X aria-hidden />
                <span className="truncate">{t("cancel")}</span>
              </Button>
              {order.status === "confirmed" || order.status === "picking" ? (
                <Button
                  variant="secondary"
                  className="min-w-0 flex-1"
                  loading={pending && pendingStep === "packed"}
                  onClick={() => move("packed")}
                >
                  <PackageCheck aria-hidden />
                  <span className="truncate">{t("pack")}</span>
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </StickyActionBar>

      <RejectSheet order={order} open={rejectOpen} onOpenChange={setRejectOpen} />
      <DeliverSheet order={order} items={items} open={deliverOpen} onOpenChange={setDeliverOpen} />
    </>
  );
}
