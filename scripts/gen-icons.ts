/**
 * Generates the favicon and PWA icons from the logo artwork in `src/lib/brand/logo-art.ts`:
 * `pnpm exec tsx scripts/gen-icons.ts`. Renders in headless Chromium so the PNGs match the
 * in-app mark exactly.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { logoColors, markMarkup, tileLayout } from "../src/lib/brand/logo-art";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "public", "icons");

/** The mark on a black tile. `rounded: false` gives a full-bleed square for platforms that
 * apply their own mask (Android maskable, iOS). */
function tileSvg({
  fraction,
  lift,
  rounded,
}: {
  fraction: number;
  lift: number;
  rounded: boolean;
}) {
  const t = tileLayout(fraction, lift);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t.size} ${t.size}">` +
    `<rect width="${t.size}" height="${t.size}"${rounded ? ` rx="${t.radius}"` : ""} fill="${logoColors.black}"/>` +
    `<g transform="translate(${t.x} ${t.y})">${markMarkup()}</g></svg>`
  );
}

async function main() {
  await mkdir(outDir, { recursive: true });

  // Browser tabs are tiny, so the favicon trims the padding.
  await writeFile(
    path.join(outDir, "favicon.svg"),
    `${tileSvg({ fraction: 0.88, lift: 0.02, rounded: true })}\n`,
  );
  console.log("wrote favicon.svg");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  async function render(file: string, size: number, svg: string) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
    );
    await page.screenshot({ path: path.join(outDir, file), omitBackground: true });
    console.log(`wrote ${file}`);
  }

  // "any": the rounded tile with transparent corners, as in the app.
  const anyIcon = tileSvg({ fraction: 0.8, lift: 0.02, rounded: true });
  await render("icon-192.png", 192, anyIcon);
  await render("icon-512.png", 512, anyIcon);

  // Maskable: launchers crop to as little as the centre circle of 80% diameter. The mark's
  // farthest point is 343 units from its centre, so at 76% width it stays inside.
  await render("icon-maskable-512.png", 512, tileSvg({ fraction: 0.76, lift: 0, rounded: false }));
  // iOS rounds the corners itself.
  await render("apple-touch-icon.png", 180, tileSvg({ fraction: 0.8, lift: 0.02, rounded: false }));

  await browser.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
