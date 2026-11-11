"use client";

import { useCallback, useSyncExternalStore } from "react";
import { themeColor } from "@/lib/brand/colors";
import {
  DEFAULT_THEME,
  isThemePreference,
  THEME_COOKIE,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

const ONE_YEAR = 60 * 60 * 24 * 365;
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]+)`));
  const value = match?.[1];
  return isThemePreference(value) ? value : DEFAULT_THEME;
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === "dark" || (preference === "system" && systemPrefersDark())
    ? "dark"
    : "light";
}

/**
 * Paints the browser's own bars (status bar, and the strip under the page on an iPhone) in the
 * app's theme. Every theme-color tag is set, and only when it differs: the framework streams
 * a second tag in after first paint and writes them again on navigation.
 */
export function syncThemeColor(): void {
  const dark = document.documentElement.classList.contains("dark");
  const wanted = dark ? themeColor.dark : themeColor.light;
  for (const tag of document.querySelectorAll('meta[name="theme-color"]')) {
    if (tag.getAttribute("content") !== wanted) tag.setAttribute("content", wanted);
  }
}

export function applyTheme(preference: ThemePreference): void {
  const resolved = resolve(preference);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  syncThemeColor();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (readPreference() === "system") applyTheme("system");
    listener();
  };
  media.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
  };
}

/** Snapshot is a primitive string so useSyncExternalStore can compare it cheaply. */
function getSnapshot(): string {
  const preference = readPreference();
  return `${preference}:${resolve(preference)}`;
}

function getServerSnapshot(): string {
  return `${DEFAULT_THEME}:light`;
}

export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [preference, resolved] = snapshot.split(":") as [ThemePreference, ResolvedTheme];

  const setPreference = useCallback((next: ThemePreference) => {
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    applyTheme(next);
    for (const listener of listeners) listener();
  }, []);

  return { preference, resolved, setPreference };
}
