import { themeColor } from "@/lib/brand/colors";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_COOKIE = "td_theme";
export const DEFAULT_THEME: ThemePreference = "light";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Runs before first paint (inlined in <head>) so dark mode never flashes white. Reads the
 * cookie, resolves "system", sets the `dark` class, color-scheme and the browser theme colour.
 * Kept dependency-free and tiny on purpose.
 */
export const themeBootScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);var p=m?m[1]:"${DEFAULT_THEME}";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute("content",d?"${themeColor.dark}":"${themeColor.light}")}catch(e){}})();`;
