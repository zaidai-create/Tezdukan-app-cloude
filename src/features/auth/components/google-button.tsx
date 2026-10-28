"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { publicEnv } from "@/lib/env";
import { googleSignInAction } from "../session-actions";

/** Google's "G", drawn in Google's own colours (tokens), as its brand guidelines ask. */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5">
      <path
        fill="var(--google-red)"
        d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.4 0 24 0 14.6 0 6.6 5.4 2.7 13.3l8 6.2C12.6 13.6 17.8 9.5 24 9.5z"
      />
      <path
        fill="var(--google-blue)"
        d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"
      />
      <path
        fill="var(--google-yellow)"
        d="M10.7 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-8-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l8-6.2z"
      />
      <path
        fill="var(--google-green)"
        d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.4 2.3-6.2 0-11.4-4.1-13.3-9.8l-8 6.2C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

/**
 * "Continue with Google". Until the Google provider is set up in Supabase the button stays,
 * but explains itself (Sandbox) instead of failing on Google's side.
 */
export function GoogleButton({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const enabled = publicEnv.NEXT_PUBLIC_GOOGLE_SIGN_IN === "on";

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        block
        loading={pending}
        onClick={() => {
          if (!enabled) return setSandboxOpen(true);
          setFailed(false);
          startTransition(async () => {
            const result = await googleSignInAction(next);
            if (result.ok) window.location.assign(result.url);
            else setFailed(true);
          });
        }}
      >
        {pending ? null : <GoogleMark />}
        {t("google")}
      </Button>
      {failed ? (
        <p role="alert" className="text-sm font-semibold text-danger-ink">
          {t("googleFailed")}
        </p>
      ) : null}
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-border" />
        {t("orPhone")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <Sheet open={sandboxOpen} onOpenChange={setSandboxOpen}>
        <SheetContent>
          <SheetHeader>
            <span className="w-fit rounded-full bg-awning-soft px-2.5 py-0.5 text-xs font-bold text-awning-ink">
              {t("sandbox")}
            </span>
            <SheetTitle>{t("googleSandboxTitle")}</SheetTitle>
            <SheetDescription>{t("googleSandboxBody")}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <Button size="lg" block onClick={() => setSandboxOpen(false)}>
              {t("signIn")}
            </Button>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
