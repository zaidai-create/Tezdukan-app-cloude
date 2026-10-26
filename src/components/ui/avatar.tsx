"use client";

import { cn } from "cn";
import { Avatar as AvatarPrimitive } from "radix-ui";
import type * as React from "react";

const tints = [
  "bg-tint-green text-primary-strong",
  "bg-tint-amber text-awning-ink",
  "bg-tint-teal text-primary-strong",
  "bg-tint-peach text-awning-ink",
  "bg-tint-sky text-ink",
  "bg-tint-sand text-ink",
] as const;

/** Stable tint per name so the same shop or person always gets the same colour. */
export function tintFor(seed: string): (typeof tints)[number] {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return tints[hash % tints.length] ?? tints[0];
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : (words[0]?.[1] ?? "");
  return (first + second).toUpperCase();
}

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative flex size-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  name,
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback> & { name: string }) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center text-sm font-semibold",
        tintFor(name),
        className,
      )}
      {...props}
    >
      {initialsOf(name)}
    </AvatarPrimitive.Fallback>
  );
}

export { Avatar, AvatarFallback, AvatarImage };
