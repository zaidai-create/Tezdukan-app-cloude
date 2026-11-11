"use client";

import { cn } from "cn";
import { Briefcase, Check, House, MapPin, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { useDeliveryPoint } from "@/features/storefront/use-delivery-point";
import { Link } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { addressText, labelKey, MAX_ADDRESSES, type SavedAddress } from "../schemas";

export function AddressLabelIcon({ label, className }: { label: string; className?: string }) {
  const key = labelKey(label);
  if (key === "Work") return <Briefcase aria-hidden className={className} strokeWidth={1.75} />;
  if (key === "Other") return <MapPin aria-hidden className={className} strokeWidth={1.75} />;
  return <House aria-hidden className={className} strokeWidth={1.75} />;
}

/** `next` is where the address screens return to once they are done. */
const withNext = (path: string, next: string) =>
  `${path}?${new URLSearchParams({ next }).toString()}`;

/**
 * The person's saved addresses as choices: tap one to have orders delivered there (and to see
 * the dukans that deliver to it), or its pencil to change it. Used on the addresses screen
 * and inside the "Deliver to" sheet.
 */
export function AddressChoices({
  addresses,
  selectedId,
  next,
  onChosen,
}: {
  addresses: SavedAddress[];
  /** The address orders go to now, if it is a saved one. */
  selectedId: string | null;
  next: string;
  onChosen?: () => void;
}) {
  const t = useTranslations("addresses");
  const tLabels = useTranslations("storefront.cart.labels");
  const { set, pending } = useDeliveryPoint();
  const full = addresses.length >= MAX_ADDRESSES;

  return (
    <div className="flex flex-col gap-3">
      {addresses.length > 0 ? (
        // A radio group, not a list: the list role would be lost under role="radiogroup".
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={t("title")}>
          {addresses.map((address) => {
            const on = address.id === selectedId;
            const located = address.lat !== null && address.lng !== null;
            const edit = withNext(`/addresses/${address.id}`, next);
            return (
              <div
                key={address.id}
                className={cn(
                  "flex items-stretch overflow-hidden rounded-lg border transition-colors",
                  on ? "border-primary bg-primary-soft" : "border-border/70 bg-surface",
                )}
              >
                {located ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={pending}
                    onClick={() => {
                      haptic("tap");
                      set({
                        lat: address.lat ?? 0,
                        lng: address.lng ?? 0,
                        label: address.line1,
                        addressId: address.id,
                      });
                      onChosen?.();
                    }}
                    className="flex min-h-16 min-w-0 flex-1 items-center gap-3 p-3 text-start"
                  >
                    <AddressRow
                      address={address}
                      on={on}
                      labelName={tLabels(labelKey(address.label))}
                    />
                  </button>
                ) : (
                  // Saved before addresses had a map pin: it has to be placed once.
                  <Link
                    href={edit}
                    className="flex min-h-16 min-w-0 flex-1 items-center gap-3 p-3 text-start"
                  >
                    <AddressRow
                      address={address}
                      on={false}
                      labelName={tLabels(labelKey(address.label))}
                      note={t("needsPin")}
                    />
                  </Link>
                )}
                <Link
                  href={edit}
                  aria-label={t("editNamed", { label: tLabels(labelKey(address.label)) })}
                  className="flex w-12 shrink-0 items-center justify-center border-s border-border/60 text-muted active:bg-subtle"
                >
                  <Pencil aria-hidden className="size-5" strokeWidth={1.75} />
                </Link>
              </div>
            );
          })}
        </div>
      ) : null}
      {full ? (
        <p className="text-sm text-muted">{t("limit", { count: MAX_ADDRESSES })}</p>
      ) : (
        <Link
          href={withNext("/addresses/new", next)}
          className={buttonVariants({ variant: "secondary", size: "lg", block: true })}
        >
          <Plus aria-hidden />
          {t("add")}
        </Link>
      )}
    </div>
  );
}

function AddressRow({
  address,
  on,
  labelName,
  note,
}: {
  address: SavedAddress;
  on: boolean;
  labelName: string;
  note?: string;
}) {
  const t = useTranslations("addresses");
  return (
    <>
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          on ? "bg-surface text-primary-strong" : "bg-primary-soft text-primary-strong",
        )}
      >
        <AddressLabelIcon label={address.label} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-semibold text-ink">
          {labelName}
          {address.is_default ? (
            <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-muted">
              {t("default")}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 text-sm text-muted" dir="auto">
          {addressText(address)}
        </span>
        {note ? <span className="block text-sm font-semibold text-awning-ink">{note}</span> : null}
      </span>
      {on ? <Check aria-hidden className="size-5 shrink-0 text-primary-strong" /> : null}
    </>
  );
}
