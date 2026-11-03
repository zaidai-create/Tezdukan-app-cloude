"use client";

import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { ANDROID_APP_COOKIE, androidAppReferrer, androidRelease } from "@/lib/app-release";

const SESSION_KEY = "td_in_android_app";
const noopSubscribe = () => () => undefined;

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function installedVersion(): number {
  const match = document.cookie.match(new RegExp(`(?:^|; )${ANDROID_APP_COOKIE}=(\\d+)`));
  return Number(match?.[1] ?? 0);
}

/**
 * Whether this page runs inside an outdated TezDukan Android app. Apps from 0.1.4 open the
 * site with `?app=<versionCode>` (kept in a cookie by the proxy); older ones send no version,
 * so an app launch without one is an old app.
 */
function readOutdated(): boolean {
  const session = sessionStore();
  if (document.referrer.startsWith(androidAppReferrer)) session?.setItem(SESSION_KEY, "1");
  if (session?.getItem(SESSION_KEY) !== "1") return false;
  return installedVersion() < androidRelease.versionCode;
}

/** Asks people on an old Android app to install the new one (the site itself is always new). */
export function AppUpdatePrompt() {
  const t = useTranslations("pwa");
  const outdated = useSyncExternalStore(noopSubscribe, readOutdated, () => false);
  const [closed, setClosed] = useState(false);
  if (!outdated || closed) return null;

  return (
    <aside
      role="dialog"
      aria-labelledby="app-update-title"
      className="fixed inset-x-3 top-[calc(var(--safe-top)+12px)] z-50 mx-auto flex max-w-md animate-in items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-raised fade-in slide-in-from-top-2"
    >
      <LogoMark className="size-11" />
      <div className="min-w-0 flex-1">
        <p id="app-update-title" className="font-heading text-base font-semibold text-ink">
          {t("updateTitle")}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {t("updateBody", { version: androidRelease.versionName })}
        </p>
        <a
          href={androidRelease.path}
          download
          className={buttonVariants({ size: "sm", className: "mt-3" })}
        >
          <Download aria-hidden />
          {t("update")}
        </a>
      </div>
      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label={t("close")}
        className="-me-2 -mt-2 flex size-12 shrink-0 items-center justify-center rounded-full text-muted"
      >
        <X aria-hidden className="size-5" />
      </button>
    </aside>
  );
}
