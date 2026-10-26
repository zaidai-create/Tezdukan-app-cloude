"use client";

import { ArrowBigUpDash, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type * as React from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

/** Password with a show/hide toggle and a Caps Lock warning on keyboards that have one. */
function PasswordInput({
  onKeyDown,
  onKeyUp,
  onBlur,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const hintId = useId();
  const readCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState("CapsLock"));
  const describedBy = [props["aria-describedby"], capsLock ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <InputGroup>
        <InputGroupInput
          type={visible ? "text" : "password"}
          onKeyDown={(event) => {
            readCapsLock(event);
            onKeyDown?.(event);
          }}
          onKeyUp={(event) => {
            readCapsLock(event);
            onKeyUp?.(event);
          }}
          onBlur={(event) => {
            setCapsLock(false);
            onBlur?.(event);
          }}
          {...props}
          aria-describedby={describedBy || undefined}
        />
        <InputGroupAddon className="px-1">
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t("hidePassword") : t("showPassword")}
            aria-pressed={visible}
            className="inline-flex size-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-ink"
          >
            <span key={visible ? "hide" : "show"} className="flex animate-pop">
              {visible ? (
                <EyeOff aria-hidden className="size-5" />
              ) : (
                <Eye aria-hidden className="size-5" />
              )}
            </span>
          </button>
        </InputGroupAddon>
      </InputGroup>
      {capsLock ? (
        <p
          id={hintId}
          role="status"
          className="flex animate-rise items-center gap-1.5 text-sm font-medium text-awning-ink"
        >
          <ArrowBigUpDash aria-hidden className="size-4" />
          {t("capsLockOn")}
        </p>
      ) : null}
    </div>
  );
}

export { PasswordInput };
