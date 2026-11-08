import { expect, type Page } from "@playwright/test";
import { PASSWORD, resetDemo, signedIn, USERS, WS } from "../integration/helpers";

export { resetDemo, signedIn, USERS, WS };

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
