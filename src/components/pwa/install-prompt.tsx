"use client";

import { Download, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "td_install_dismissed_at";
const VISITS_KEY = "td_visits";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

function readNumber(key: string): number {
  try {
    return Number(window.localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage blocked (private mode): the prompt just won't remember.
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

type Eligibility = "no" | "ios" | "web";
const noopSubscribe = () => () => undefined;

/** Eligible from the second visit on, never when installed, snoozed after "Not now". */
function readEligibility(): Eligibility {
  if (isStandalone()) return "no";
  const snoozed = Date.now() - readNumber(DISMISS_KEY) < SNOOZE_MS;
  if (readNumber(VISITS_KEY) < 1 || snoozed) return "no";
  return isIos() ? "ios" : "web";
}

/**
 * A quiet "Install TezDukan" card. Shown only after real use (second visit), never when
 * already installed, and snoozed for two weeks after "Not now". iOS gets the Share → Add to
 * Home Screen hint because Safari has no install prompt.
 */
export function InstallPrompt() {
  const t = useTranslations("pwa");
  const eligibility = useSyncExternalStore(noopSubscribe, readEligibility, () => "no" as const);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);

  // Count this visit (read on the next one).
  useEffect(() => {
    writeNumber(VISITS_KEY, readNumber(VISITS_KEY) + 1);
  }, []);

  useEffect(() => {
    if (eligibility !== "web") return;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setClosed(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [eligibility]);

  const mode =
    closed || eligibility === "no"
      ? "hidden"
      : eligibility === "ios"
        ? "ios"
        : deferred
          ? "prompt"
          : "hidden";

  const dismiss = () => {
    writeNumber(DISMISS_KEY, Date.now());
    setClosed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "dismissed") dismiss();
    else setClosed(true);
  };

  if (mode === "hidden") return null;

  return (
    <aside
      role="dialog"
      aria-labelledby="install-title"
      className="fixed inset-x-3 top-[calc(var(--safe-top)+12px)] z-50 mx-auto flex max-w-md animate-in items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-raised fade-in slide-in-from-top-2"
    >
      <LogoMark className="size-11" />
      <div className="min-w-0 flex-1">
        <p id="install-title" className="font-heading text-base font-semibold text-ink">
          {t("installTitle")}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {mode === "ios" ? t("iosHint") : t("installBody")}
        </p>
        {mode === "prompt" ? (
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={install}>
              <Download aria-hidden />
              {t("install")}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t("notNow")}
            </Button>
          </div>
        ) : (
          <Share aria-hidden className="mt-2 size-5 text-primary-strong" />
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("notNow")}
        className="-me-1 -mt-1 inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-ink"
      >
        <X aria-hidden className="size-5" />
      </button>
    </aside>
  );
}
