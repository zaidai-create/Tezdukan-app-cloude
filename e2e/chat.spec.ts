import { type Browser, expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { createDukandar, deleteUserByPhone } from "./support/admin";
import { messages } from "./support/messages";

/**
 * Chat between a dukan and its distributor (live, both ways) and the support chat, where the
 * TezDukan assistant answers first and the team is one tap away. A fresh dukan per run; the
 * demo distributor answers.
 */
const { auth, chat, account } = messages.en;
const PASSWORD = "dukan-e2e-123";

const throwawayNumber = () => `0397${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
const toE164 = (national: string) => `+92${national.slice(1)}`;

async function signedIn(browser: Browser, baseURL: string, phone: string, password: string) {
  const context = await browser.newContext({ locale: "en-PK", timezoneId: "Asia/Karachi" });
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL }]);
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel(auth.phoneLabel).fill(phone);
  await page.getByLabel(auth.passwordLabel, { exact: true }).fill(password);
  await page.getByRole("button", { name: auth.signIn }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return page;
}

test.describe("chat", () => {
  // Made in beforeAll: Playwright can run it again in the same worker, and a user with orders
  // is never fully deleted, so each run needs its own number.
  let phone = "";

  test.beforeAll(async () => {
    phone = throwawayNumber();
    await createDukandar(toE164(phone), PASSWORD, "Kamran Kiryana");
  });

  test.afterAll(async () => {
    await deleteUserByPhone(toE164(phone)).catch(() => undefined);
  });

  test("a dukan and its distributor chat live", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const base = baseURL ?? "";
    const question = `Kal delivery ho sakti hai? ${phone.slice(-4)}`;
    const dukandar = await signedIn(browser, base, phone, PASSWORD);
    const distributor = await signedIn(browser, base, "03000000003", "TezDukan-Demo-1");

    await dukandar.goto(`${base}/dukan/chat`);
    await expect(dukandar.getByRole("heading", { name: chat.startTitle })).toBeVisible();
    await dukandar.getByRole("link", { name: "Indus Traders" }).click();
    await expect(dukandar.getByRole("heading", { level: 1, name: "Indus Traders" })).toBeVisible({
      timeout: 15_000,
    });
    await dukandar.getByLabel(chat.placeholder).fill(question);
    await dukandar.getByRole("button", { name: chat.send, exact: true }).click();
    await expect(dukandar.getByRole("log").getByText(question)).toBeVisible();

    await distributor.goto(`${base}/distributor/chat`);
    const row = distributor.getByRole("link").filter({ hasText: question });
    await expect(row).toContainText("Kamran Kiryana Store");
    await row.click();
    await expect(distributor.getByRole("log").getByText(question)).toBeVisible();
    await expectAccessible(distributor);
    await distributor.getByRole("button", { name: chat.quick.org.r2 }).click();

    // The reply reaches the dukan's open chat without a reload.
    await expect(dukandar.getByRole("log").getByText(chat.quick.org.r2)).toBeVisible({
      timeout: 15_000,
    });

    await distributor.context().close();
    await dukandar.context().close();
  });

  test("support: the assistant answers first and the team is one tap away", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const base = baseURL ?? "";
    const dukandar = await signedIn(browser, base, phone, PASSWORD);
    await dukandar.goto(`${base}/dukan/account`);
    await dukandar.getByRole("link", { name: new RegExp(account.liveChat) }).click();
    await expect(dukandar.getByRole("heading", { level: 1, name: chat.support })).toBeVisible({
      timeout: 15_000,
    });
    await dukandar.getByRole("button", { name: chat.quick.support.r1 }).click();
    const log = dukandar.getByRole("log");
    // The AI answers; without an AI key (or when it is busy) the chat says so honestly.
    await expect(
      log
        .getByText(chat.assistantName)
        .or(log.getByText(chat.assistantRetry))
        .or(log.getByText(chat.assistantUnavailable))
        .first(),
    ).toBeVisible({ timeout: 40_000 });
    const talk = dukandar.getByRole("button", { name: chat.talkToTeam });
    if (await talk.isVisible()) {
      await talk.click();
      await expect(log.getByText(chat.teamRequested)).toBeVisible();
      await expect(talk).toBeHidden();
    }
    await expectAccessible(dukandar);
    await dukandar.context().close();
  });
});
