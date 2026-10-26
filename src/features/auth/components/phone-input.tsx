"use client";

import { CircleCheck } from "lucide-react";
import type * as React from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { formatPkMobileInput, isPkMobile } from "@/lib/phone";

/**
 * Pakistani mobile number with a fixed +92 prefix. Spaces itself as it is typed
 * ("0300 1234567") and shows a check once the number is complete. Any common format is
 * accepted; normalisation to E.164 happens in the schema and the server action.
 */
function PhoneInput({ onChange, value, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const complete = typeof value === "string" && isPkMobile(value);
  return (
    <InputGroup dir="ltr">
      <InputGroupAddon className="num border-e border-border pe-3 font-semibold text-ink">
        {"+92"}
      </InputGroupAddon>
      <InputGroupInput
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className="num ps-3 tracking-wide"
        value={value}
        onChange={(event) => {
          const input = event.currentTarget;
          const formatted = formatPkMobileInput(input.value, input.selectionStart ?? undefined);
          if (formatted.value !== input.value) {
            input.value = formatted.value;
            input.setSelectionRange(formatted.caret, formatted.caret);
          }
          onChange?.(event);
        }}
        {...props}
      />
      {complete ? (
        <InputGroupAddon aria-hidden className="ps-0">
          <CircleCheck className="size-5 animate-pop text-primary-strong" />
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

export { PhoneInput };
