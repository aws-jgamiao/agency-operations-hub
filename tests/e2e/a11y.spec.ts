import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login, resetDemo, USERS } from "./fixtures";

test.beforeAll(resetDemo);

async function noSerious(page: import("@playwright/test").Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test("public and staff pages", async ({ page }) => {
  for (const p of ["/", "/login"]) {
    await page.goto(p);
    await noSerious(page);
  }
  await login(page, USERS.sam);
  for (const p of ["/dashboard", "/tasks", "/requests", "/kb", "/kb/deploy-checklist"]) {
    await page.goto(p);
    await noSerious(page);
  }
});

test("admin pages", async ({ page }) => {
  await login(page, USERS.admin);
  for (const p of ["/team", "/audit", "/integrations", "/tasks/new", "/requests/new"]) {
    await page.goto(p);
    await noSerious(page);
  }
});
