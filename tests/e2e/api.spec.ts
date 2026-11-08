import { expect, test } from "@playwright/test";
import { resetDemo, signedIn, USERS, WS } from "./fixtures";

test.beforeEach(resetDemo);

test("GET /api/v1/tasks requires authentication", async ({ request }) => {
  const res = await request.get("/api/v1/tasks");
  expect(res.status()).toBe(401);
  expect(res.headers()["content-type"]).toContain("application/problem+json");
});

test("bearer token: list is scoped to the caller's workspaces and paginates with a cursor", async ({ request }) => {
  const { token } = await signedIn(USERS.sam);
  const headers = { Authorization: `Bearer ${token}` };
  const first = await (await request.get("/api/v1/tasks?limit=3", { headers })).json();
  expect(first.data).toHaveLength(3);
  expect(first.next_cursor).toBeTruthy();
  const second = await (await request.get(`/api/v1/tasks?limit=3&cursor=${first.next_cursor}`, { headers })).json();
  const ids = [...first.data, ...second.data].map((t: { id: string }) => t.id);
  expect(new Set(ids).size).toBe(ids.length); // no duplicates across pages
  const all = await (await request.get("/api/v1/tasks?limit=100", { headers })).json();
  expect(all.data.every((t: { workspace: { id: string } }) => t.workspace.id === WS.north || t.workspace.id === WS.internal)).toBe(true);
});

test("PATCH with a stale version returns 409; another workspace's task returns 404", async ({ request }) => {
  const { token } = await signedIn(USERS.sam);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const list = await (await request.get("/api/v1/tasks?assignee=me&status=open&limit=1", { headers })).json();
  const task = list.data[0];

  const ok = await request.patch(`/api/v1/tasks/${task.id}`, { headers, data: { version: task.version, status: "in_progress" } });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).data.version).toBe(task.version + 1);

  const stale = await request.patch(`/api/v1/tasks/${task.id}`, { headers, data: { version: task.version, status: "done" } });
  expect(stale.status()).toBe(409);
  expect(await stale.json()).toMatchObject({ status: 409, current_version: task.version + 1 });

  const { client: admin } = await signedIn(USERS.admin);
  const { data: harb } = await admin.from("tasks").select("id, version").eq("workspace_id", WS.harb).limit(1).single();
  const hidden = await request.patch(`/api/v1/tasks/${harb!.id}`, { headers, data: { version: harb!.version, status: "done" } });
  expect(hidden.status()).toBe(404);
  const missing = await request.patch("/api/v1/tasks/00000000-0000-4000-8000-000000000000", { headers, data: { version: 1, status: "done" } });
  expect(missing.status()).toBe(404);
});

test("staff cannot reassign via the API (403) and invalid bodies get 422", async ({ request }) => {
  const { token } = await signedIn(USERS.sam);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const list = await (await request.get("/api/v1/tasks?assignee=me&status=open&limit=1", { headers })).json();
  const task = list.data[0];
  const reassign = await request.patch(`/api/v1/tasks/${task.id}`, { headers, data: { version: task.version, priority: "urgent" } });
  expect(reassign.status()).toBe(403);
  const invalid = await request.patch(`/api/v1/tasks/${task.id}`, { headers, data: { version: task.version, status: "finished" } });
  expect(invalid.status()).toBe(422);
  expect((await invalid.json()).errors[0].path).toBe("status");
  const unknownField = await request.patch(`/api/v1/tasks/${task.id}`, { headers, data: { version: task.version, workspace_id: WS.harb } });
  expect(unknownField.status()).toBe(422);
});

test("cookie-authenticated writes from another origin are rejected (CSRF)", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(USERS.admin);
  await page.getByLabel("Password", { exact: true }).fill("DemoOps!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/dashboard/);
  const res = await page.request.post("/api/v1/tasks", {
    headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
    data: { workspaceId: WS.north, title: "CSRF task" },
  });
  expect(res.status()).toBe(403);
  const sameOrigin = await page.request.post("/api/v1/tasks", {
    headers: { Origin: new URL(page.url()).origin, "Content-Type": "application/json" },
    data: { workspaceId: WS.north, title: "Legit task from the API" },
  });
  expect(sameOrigin.status()).toBe(201);
});

test("staff cannot create tasks through the API", async ({ request }) => {
  const { token } = await signedIn(USERS.sam);
  const res = await request.post("/api/v1/tasks", {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { workspaceId: WS.north, title: "Sneaky" },
  });
  expect(res.status()).toBe(403);
});
