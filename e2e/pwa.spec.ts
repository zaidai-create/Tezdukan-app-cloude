import { expect, test } from "@playwright/test";
import { messages } from "./support/messages";

test.describe("installable app", () => {
  test.skip(process.env.E2E_DEV === "1", "The service worker only runs in production builds");

  test("serves a manifest whose icons all load", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = (await response.json()) as {
      name: string;
      icons: { src: string; purpose: string }[];
    };
    expect(manifest.name).toBe("TezDukan");
    expect(manifest.icons.map((icon) => icon.purpose)).toEqual(
      expect.arrayContaining(["any", "maskable"]),
    );
    for (const icon of manifest.icons) {
      expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
    }
  });

  test("shows the offline page when the network drops", async ({ page, context }) => {
    await page.goto("/login");
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            Boolean(navigator.serviceWorker.controller) &&
            Boolean(await caches.match("/~offline", { ignoreSearch: true })),
        ),
      )
      .toBe(true);

    await context.setOffline(true);
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: messages.en.offlinePage.title })).toBeVisible();
    await context.setOffline(false);
  });

  test("only serves the files the build emits", async ({ request }) => {
    expect((await request.get("/serwist/sw.js")).ok()).toBe(true);
    expect((await request.get("/serwist/other.js")).status()).toBe(404);
  });
});
