// README screenshots (synthetic demo data only):
//   npx playwright test -c playwright.screenshots.config.ts
import { test, type Page } from "@playwright/test";
import { login, resetDemo, USERS } from "../e2e/fixtures";

const out = (name: string) => `docs/screenshots/${name}.png`;
async function ready(page: Page) {
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.locator(".animate-pulse").waitFor({ state: "detached" }).catch(() => {});
  await page.waitForLoadState("networkidle");
}

test.beforeAll(resetDemo);

test("capture", async ({ page, browser }) => {
  await page.goto("/");
  await ready(page);
  await page.screenshot({ path: out("01-landing"), fullPage: true });

  await login(page, USERS.admin);
  await ready(page);
  await page.screenshot({ path: out("02-dashboard"), fullPage: true });
  await page.goto("/tasks?status=open");
  await ready(page);
  await page.screenshot({ path: out("03-tasks"), fullPage: true });
  await page.goto("/tasks?q=Maps");
  await page.getByRole("link", { name: "Fix broken Google Maps embed" }).click();
  await ready(page);
  await page.screenshot({ path: out("04-task-detail"), fullPage: true });

  await page.goto("/integrations");
  await page.getByLabel("Simulated Slack response").first().selectOption("rate_limited");
  await page.getByRole("button", { name: "Queue and deliver test message" }).click();
  await page.getByText(/\[Mock mode\]/).waitFor();
  await page.getByLabel("Simulated Slack response").first().selectOption("ok");
  await page.getByRole("button", { name: "Queue and deliver test message" }).click();
  await page.getByText(/Processed 1: 1 sent/).waitFor();
  await ready(page);
  await page.screenshot({ path: out("05-integrations"), fullPage: true });
  await page.goto("/audit");
  await ready(page);
  await page.screenshot({ path: out("06-audit"), fullPage: true });
  await page.goto("/team");
  await ready(page);
  await page.screenshot({ path: out("07-team"), fullPage: true });

  const mobile = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await login(mobile, USERS.sam);
  await ready(mobile);
  await mobile.screenshot({ path: out("08-mobile-dashboard") });
});
