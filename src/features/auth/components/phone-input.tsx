"use client";

import type * as React from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

/**
 * Pakistani mobile number with a fixed +92 prefix. Accepts any common format (0300…, 300…,
 * with spaces or dashes); normalisation to E.164 happens in the schema/server action.
 */
function PhoneInput(props: Omit<React.ComponentProps<"input">, "type">) {
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
        {...props}
      />
    </InputGroup>
  );
}

export { PhoneInput };
