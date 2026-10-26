/**
 * Brand colours for places CSS variables cannot reach: the web manifest, the browser
 * theme-color, generated icons, PDFs and map markers. Components use the CSS tokens instead.
 * Keep in sync with `src/app/globals.css`.
 */
export const brand = {
  primary: "#0A8F5A",
  primaryStrong: "#07704A",
  mint: "#2ED3A3",
  awning: "#FFB627",
  awningDeep: "#FF7A1A",
  ink: "#0F1A15",
  canvas: "#F5F8F6",
  surface: "#FFFFFF",
  black: "#0A0F0D",
  white: "#FFFFFF",
  darkSurface: "#121A17",
} as const;

export const themeColor = { light: brand.surface, dark: brand.black } as const;
