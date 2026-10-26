/**
 * Only same-site relative paths may be used as a post-login destination. Blocks open
 * redirects like `//evil.com`, `/\evil.com` and absolute URLs.
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const url = new URL(value, "https://tezdukan.invalid");
    if (url.origin !== "https://tezdukan.invalid") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
