import { expect, test } from "@playwright/test";
import { login, resetDemo, USERS } from "./fixtures";

test.beforeEach(resetDemo);

test("staff only see their own workspaces' work", async ({ page }) => {
  await login(page, USERS.sam);
  await page.goto("/tasks");
  await expect(page.getByRole("link", { name: "Build catering enquiry form" })).toBeVisible();
  await expect(page.getByText("SMS reminder templates")).toHaveCount(0);
  await page.goto("/requests");
  await expect(page.getByText("Reminder SMS shows wrong clinic name")).toHaveCount(0);
});

test("filters are reflected in the URL and narrow the list", async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto("/tasks");
  await page.getByLabel("Due").selectOption("overdue");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/due=overdue/);
  await expect(page.getByRole("link", { name: "Rotate shared credentials" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Image optimisation pass" })).toHaveCount(0);
});

test("concurrent edits: the second save gets a conflict instead of overwriting", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await login(a, USERS.admin);
  await login(b, USERS.admin);
  await a.goto("/tasks?q=catering");
  await a.getByRole("link", { name: "Build catering enquiry form" }).click();
  // Wait for the task page before reading its URL (the click navigates asynchronously).
  await expect(a.getByRole("heading", { level: 1, name: "Build catering enquiry form" })).toBeVisible();
  await b.goto(a.url());

  await a.getByLabel("Status").selectOption("blocked");
  await a.getByRole("button", { name: "Save changes" }).click();
  await expect(a.getByText("Task saved.")).toBeVisible();

  await b.getByLabel("Priority").selectOption("urgent");
  await b.getByRole("button", { name: "Save changes" }).click();
  await expect(b.getByRole("alert").filter({ hasText: "Someone else saved this task" })).toBeVisible();
});

test("staff update their own task status; they can't edit others' tasks", async ({ page }) => {
  await login(page, USERS.sam);
  await page.goto("/tasks?q=Image");
  await page.getByRole("link", { name: "Image optimisation pass" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Image optimisation pass" })).toBeVisible();
  await expect(page.getByLabel("Priority")).toHaveCount(0); // staff form: status + description only
  await page.getByLabel("Status").selectOption("in_progress");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Task saved.")).toBeVisible();
  await expect(page.getByText("status: todo → in progress")).toBeVisible(); // audit history

  await page.goto("/tasks?q=Homepage");
  await page.getByRole("link", { name: "Homepage visual design" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Homepage visual design" })).toBeVisible();
  await expect(page.getByText("Only the assignee or an admin can update this task.")).toBeVisible();
});

test("assigning a task queues a Slack notification delivered in mock mode", async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto("/tasks?q=Go-live");
  await page.getByRole("link", { name: "Go-live checklist" }).click();
  // The list page also has an "Assignee" filter, so wait for the task page first.
  await expect(page.getByRole("heading", { level: 1, name: "Go-live checklist" })).toBeVisible();
  await page.getByLabel("Assignee").selectOption({ label: "Chris Okafor" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Task saved.")).toBeVisible();

  await page.goto("/integrations");
  await expect(page.getByText("Mock mode: nothing is sent to Slack")).toBeVisible();
  const row = page.getByRole("row", { name: /Chris Okafor was assigned "Go-live checklist"/ });
  await expect(row).toBeVisible();
  await expect(async () => {
    await page.reload();
    await expect(row.getByText("sent", { exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
});

test("a simulated 429 is recorded as rate limited with a scheduled retry", async ({ page }) => {
  await login(page, USERS.admin);
  await page.goto("/integrations");
  await page.getByLabel("Simulated Slack response").first().selectOption("rate_limited");
  await page.getByRole("button", { name: "Queue and deliver test message" }).click();
  await expect(page.getByText(/\[Mock mode\] Processed 1: 0 sent, rate limited/)).toBeVisible();
  const row = page.getByRole("row", { name: /Test notification from Ops Hub/ }).first();
  await expect(row.getByText("rate limited", { exact: true })).toBeVisible();
  await expect(row.getByText("HTTP 429")).toBeVisible();
  await expect(row.getByText(/Next try/)).toBeVisible();
});

test("resolving a client request requires a resolution", async ({ page }) => {
  await login(page, USERS.sam);
  await page.goto("/requests?view=mine");
  await page.getByRole("link", { name: "Add gluten-free filter to menu" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add gluten-free filter to menu" })).toBeVisible();
  await page.getByLabel("Status").selectOption("resolved");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Describe how the request was resolved.")).toBeVisible();
  await page.getByLabel("Resolution").fill("Added a dietary filter to the menu page.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Request updated.")).toBeVisible();
  await expect(page.getByText("Added a dietary filter to the menu page.").first()).toBeVisible();
});

test("knowledge base respects role and workspace restrictions", async ({ page, browser }) => {
  await login(page, USERS.chris);
  await page.goto("/kb");
  await expect(page.getByRole("link", { name: "Harbour Physio: SMS provider notes" })).toBeVisible();
  await expect(page.getByText("Rate card and margins")).toHaveCount(0);

  const sam = await (await browser.newContext()).newPage();
  await login(sam, USERS.sam);
  const res = await sam.goto("/kb/harbour-sms-notes");
  expect(res?.status()).toBe(404);
  const admin = await sam.goto("/kb/rate-card");
  expect(admin?.status()).toBe(404);
});

test("admin-only pages return 404 for staff", async ({ page }) => {
  await login(page, USERS.sam);
  for (const path of ["/team", "/audit", "/integrations", "/tasks/new"]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
  }
});

test("deactivating a member locks them out immediately", async ({ page, browser }) => {
  const sam = await (await browser.newContext()).newPage();
  await login(sam, USERS.sam);

  await login(page, USERS.admin);
  await page.goto("/team");
  await page.getByRole("button", { name: /Deactivate\s*Sam Patel/ }).click();
  await expect(page.getByRole("button", { name: /Reactivate\s*Sam Patel/ })).toBeVisible();

  await sam.goto("/tasks");
  await expect(sam).toHaveURL(/\/no-access$/);
});
