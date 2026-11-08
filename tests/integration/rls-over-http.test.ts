import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDemo, signedIn, USERS, WS, type Client } from "./helpers";

describe("workspace isolation and staff limits over the real API", () => {
  let sam: Client;
  let chris: Client;
  let admin: Client;

  beforeAll(async () => {
    await resetDemo();
    const [s, c, a] = await Promise.all([signedIn(USERS.sam), signedIn(USERS.chris), signedIn(USERS.admin)]);
    sam = s.client;
    chris = c.client;
    admin = a.client;
  });
  afterAll(resetDemo);

  it("each staff member only sees tasks from their own workspaces", async () => {
    const { data: samTasks } = await sam.from("tasks").select("workspace_id");
    const { data: chrisTasks } = await chris.from("tasks").select("workspace_id");
    expect(new Set(samTasks?.map((t) => t.workspace_id))).toEqual(new Set([WS.north, WS.internal]));
    expect(new Set(chrisTasks?.map((t) => t.workspace_id))).toEqual(new Set([WS.harb]));
  });

  it("guessing another workspace's task id returns nothing", async () => {
    const { data: harbTask } = await admin.from("tasks").select("id").eq("workspace_id", WS.harb).limit(1).single();
    const { data } = await sam.from("tasks").select("*").eq("id", harbTask!.id);
    expect(data).toEqual([]);
  });

  it("staff cannot reassign work, even their own", async () => {
    const { data: t } = await sam.from("tasks").select("id").eq("title", "Image optimisation pass").single();
    const { error } = await sam.from("tasks").update({ assignee_id: null }).eq("id", t!.id);
    expect(error?.code).toBe("42501");
  });

  it("the outbox lease RPCs reject anonymous callers", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { db: { schema: "ops" } });
    const { error } = await anon.rpc("claim_notifications", { p_limit: 5 });
    expect(error).not.toBeNull();
  });

  // Regression (fix/notification-trigger-enum-cast): these failed with 22P02.
  it("admin can create, re-save and unassign tasks without an assignee change", async () => {
    const created = await admin.from("tasks").insert({ workspace_id: WS.north, title: "Unassigned via API" }).select("id").single();
    expect(created.error).toBeNull();
    const resave = await admin.from("tasks").update({ assignee_id: null, status: "blocked" }).eq("id", created.data!.id);
    expect(resave.error).toBeNull();
    const { data: t } = await admin.from("tasks").select("id, assignee_id").eq("title", "Build catering enquiry form").single();
    expect((await admin.from("tasks").update({ assignee_id: t!.assignee_id }).eq("id", t!.id)).error).toBeNull();
    expect((await admin.from("tasks").update({ assignee_id: null }).eq("id", t!.id)).error).toBeNull();
  });

  it("the demo reset works through PostgREST (pg-safeupdate is loaded there)", async () => {
    const { error } = await admin.rpc("reset_demo");
    expect(error).toBeNull();
  });
});
