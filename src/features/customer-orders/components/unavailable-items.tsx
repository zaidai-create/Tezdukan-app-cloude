"use client";

import { cn } from "cn";
import { PackageX, PhoneCall, Repeat, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { storageUrl } from "@/features/ordering/images";
import { haptic } from "@/lib/haptics";
import { formatRs } from "@/lib/money";
import { findReplacements, removeOrderItem, replaceOrderItem } from "../actions";
import type { CustomerOrder, CustomerOrderItem, Replacement } from "../schemas";

const choiceIcon = { call_me: PhoneCall, replace: Repeat, remove: Trash2 } as const;

/** The customer's answer to "what if something is missing?", where the dukandar packs. */
export function UnavailableChoiceNote({ choice }: { choice: CustomerOrder["if_unavailable"] }) {
  const t = useTranslations("customerOrders.unavailable");
  const Icon = choiceIcon[choice];
  return (
    <p className="flex items-start gap-3 rounded-lg border border-awning/40 bg-awning-soft p-3.5 text-ink">
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-awning-ink" strokeWidth={1.75} />
      <span>
        <span className="block text-sm text-muted">{t("customerSays")}</span>
        <span className="block font-semibold">{t(`choice.${choice}`)}</span>
      </span>
    </p>
  );
}

/**
 * For each line: "Not available" opens a sheet to leave it out, or (unless the customer asked
 * for removal) send one of the dukan's own products at the same price or less.
 */
export function UnavailableItems({ order }: { order: CustomerOrder }) {
  const t = useTranslations("customerOrders.unavailable");
  const locale = useLocale();
  const [open, setOpen] = useState<CustomerOrderItem | null>(null);
  const items = order.customer_order_items ?? [];
  if (!["placed", "accepted", "packed"].includes(order.status) || items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
          <PackageX aria-hidden className="size-5 text-primary" strokeWidth={1.75} />
          {t("title")}
        </h2>
        <p className="text-sm text-muted">{t("hint")}</p>
      </div>
      <UnavailableChoiceNote choice={order.if_unavailable} />
      <ul className="flex flex-col divide-y divide-border/60">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">
                <bdi>{locale === "ur" && item.name_ur ? item.name_ur : item.name}</bdi>
              </span>
              <span className="num text-sm text-muted">
                {item.qty} × {formatRs(item.unit_price_paisa)}
              </span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={items.length <= 1}
              onClick={() => setOpen(item)}
            >
              {t("notAvailable")}
            </Button>
          </li>
        ))}
      </ul>
      {items.length <= 1 ? <p className="text-sm text-muted">{t("lastItemHint")}</p> : null}
      {open ? (
        <LineSheet item={open} choice={order.if_unavailable} onClose={() => setOpen(null)} />
      ) : null}
    </section>
  );
}

function LineSheet({
  item,
  choice,
  onClose,
}: {
  item: CustomerOrderItem;
  choice: CustomerOrder["if_unavailable"];
  onClose: () => void;
}) {
  const t = useTranslations("customerOrders.unavailable");
  const tErrors = useTranslations("customerOrders.errors");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [options, setOptions] = useState<Replacement[] | null>(null);
  const [loading, setLoading] = useState(false);
  const name = locale === "ur" && item.name_ur ? item.name_ur : item.name;

  const finish = (result: { ok: true } | { ok: false; error: string }, message: string) => {
    if (!result.ok) {
      haptic("warning");
      toast.error(tErrors(result.error as "generic"));
      return;
    }
    haptic("success");
    toast.success(message);
    onClose();
  };

  const showReplacements = () => {
    setLoading(true);
    startTransition(async () => {
      const result = await findReplacements(item.id);
      setLoading(false);
      if (!result.ok) {
        toast.error(tErrors(result.error));
        return;
      }
      setOptions(result.data);
    });
  };

  return (
    <Sheet open onOpenChange={(next) => (next ? null : onClose())}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("sheetTitle", { name })}</SheetTitle>
          <SheetDescription>{t(`choice.${choice}`)}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-3">
          <Button
            variant="danger-soft"
            size="lg"
            block
            loading={pending && options === null && !loading}
            onClick={() =>
              startTransition(async () => finish(await removeOrderItem(item.id), t("removed")))
            }
          >
            <Trash2 aria-hidden />
            {t("remove")}
          </Button>
          {choice === "remove" ? (
            <p className="text-sm text-muted">{t("noReplaceHint")}</p>
          ) : options === null ? (
            <Button
              variant="secondary"
              size="lg"
              block
              loading={loading}
              onClick={showReplacements}
            >
              <Repeat aria-hidden />
              {t("replace")}
            </Button>
          ) : (
            <section className="flex flex-col gap-2">
              <h3 className="font-heading text-base font-bold text-ink">{t("pickTitle")}</h3>
              <p className="text-sm text-muted">{t("pickHint")}</p>
              {options.length === 0 ? (
                <p className="rounded-md bg-subtle p-3 text-sm text-muted">{t("noOptions")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {options.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () =>
                            finish(
                              await replaceOrderItem(item.id, option.id),
                              t("replaced", { name: option.name }),
                            ),
                          )
                        }
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border p-2.5 text-start transition-colors duration-150",
                          option.same_category
                            ? "border-primary/40 bg-primary-soft/40"
                            : "border-border bg-surface",
                        )}
                      >
                        <ProductImage
                          src={storageUrl(option.image_path)}
                          alt={option.name}
                          sizes="48px"
                          className="size-12 shrink-0 rounded-lg border border-border/60"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-ink">
                            <bdi>
                              {locale === "ur" && option.name_ur ? option.name_ur : option.name}
                            </bdi>
                          </span>
                          <span className="num text-sm text-muted">
                            {option.pack_size_label ? `${option.pack_size_label} · ` : null}
                            {formatRs(option.selling_price_paisa)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {loading ? <Skeleton className="h-16 w-full rounded-xl" /> : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
