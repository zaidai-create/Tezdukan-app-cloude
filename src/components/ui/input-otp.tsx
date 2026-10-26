"use client";

import { cn } from "cn";
import { OTPInput, OTPInputContext } from "input-otp";
import * as React from "react";

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      // OTP digits are always typed left-to-right, even in Urdu.
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      spellCheck={false}
      inputMode="numeric"
      autoComplete="one-time-code"
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      dir="ltr"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & { index: number }) {
  const context = React.useContext(OTPInputContext);
  const slot = context.slots[index];
  const active = slot?.isActive ?? false;
  return (
    <div
      data-slot="input-otp-slot"
      data-active={active}
      className={cn(
        "relative flex h-14 w-12 items-center justify-center rounded-md border border-border-strong bg-surface",
        "num font-heading text-2xl font-semibold text-ink transition-[border-color,box-shadow] duration-150",
        "data-[active=true]:border-primary-strong data-[active=true]:ring-3 data-[active=true]:ring-primary/20",
        "aria-invalid:border-danger-ink",
        className,
      )}
      {...props}
    >
      {slot?.char}
      {slot?.hasFakeCaret ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-6 w-px animate-pulse bg-ink" />
        </span>
      ) : null}
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot };
