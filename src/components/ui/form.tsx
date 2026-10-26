"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Slot } from "radix-ui";
import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Label } from "./label";

/**
 * React Hook Form bindings. Zod issue messages are keys in the `validation` namespace
 * (see `features/*\/schemas.ts`); FormMessage translates them.
 */
const Form = FormProvider;

type FieldContextValue = { name: string };
const FormFieldContext = React.createContext<FieldContextValue | null>(null);
const FormItemContext = React.createContext<{ id: string } | null>(null);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const field = React.useContext(FormFieldContext);
  const item = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: field?.name });
  if (!field || !item) throw new Error("useFormField must be used inside <FormField><FormItem>");
  const state = getFieldState(field.name, formState);
  return {
    id: item.id,
    name: field.name,
    controlId: `${item.id}-control`,
    hintId: `${item.id}-hint`,
    messageId: `${item.id}-message`,
    ...state,
  };
}

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn("grid gap-2", className)} {...props} />
    </FormItemContext.Provider>
  );
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const { controlId, error } = useFormField();
  return (
    <Label
      data-slot="form-label"
      data-error={Boolean(error)}
      htmlFor={controlId}
      className={cn("data-[error=true]:text-danger-ink", className)}
      {...props}
    />
  );
}

function FormControl(props: React.ComponentProps<typeof Slot.Root>) {
  const { controlId, hintId, messageId, error } = useFormField();
  return (
    <Slot.Root
      data-slot="form-control"
      id={controlId}
      aria-describedby={error ? `${hintId} ${messageId}` : hintId}
      aria-invalid={Boolean(error)}
      {...props}
    />
  );
}

function FormHint({ className, ...props }: React.ComponentProps<"p">) {
  const { hintId } = useFormField();
  return (
    <p
      data-slot="form-hint"
      id={hintId}
      className={cn("text-sm text-muted", className)}
      {...props}
    />
  );
}

function FormMessage({ className, children, ...props }: React.ComponentProps<"p">) {
  const { error, messageId } = useFormField();
  const t = useTranslations("validation");
  const raw = error?.message;
  const key = raw as Parameters<typeof t>[0];
  // Schema issues carry `validation.*` keys; anything else is shown as given.
  const body = raw ? (t.has(key) ? t(key) : raw) : children;
  if (!body) return null;
  return (
    <p
      data-slot="form-message"
      id={messageId}
      role="alert"
      className={cn("text-sm font-medium text-danger-ink", className)}
      {...props}
    >
      {body}
    </p>
  );
}

export { Form, FormControl, FormField, FormHint, FormItem, FormLabel, FormMessage, useFormField };
