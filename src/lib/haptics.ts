/** Light haptic feedback on supported phones (Android Chrome). Silently no-ops elsewhere. */
export function haptic(pattern: "tap" | "success" | "warning" = "tap"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const patterns: Record<typeof pattern, number | number[]> = {
    tap: 10,
    success: [12, 40, 18],
    warning: [30, 50, 30],
  };
  navigator.vibrate(patterns[pattern]);
}
