import { expect, test } from "@playwright/test";
import { login, resetDemo, USERS } from "./fixtures";

test.beforeAll(resetDemo);

test("mobile: navigation works and wide tables scroll inside their card, not the page", async ({ page }) => {
  await login(page, USERS.admin);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Tasks" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  for (const p of ["/dashboard", "/tasks", "/requests", "/team", "/integrations"]) {
    await page.goto(p);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  }
});
