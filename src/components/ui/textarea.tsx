import { cn } from "cn";
import type * as React from "react";
import { fieldClass } from "./input";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClass, "field-sizing-content min-h-24 px-3.5 py-3", className)}
      {...props}
    />
  );
}

export { Textarea };
