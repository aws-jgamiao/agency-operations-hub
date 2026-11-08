import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, toSearchPattern } from "./cursor";
import { addDays, agencyToday, daysBetween, dueState } from "./format";
import { describeChanges } from "@/components/audit-list";
import { articleSchema, taskFiltersSchema, updateRequestSchema, updateTaskSchema } from "./validation/schemas";

describe("keyset cursor", () => {
  it("round-trips", () => {
    const c = { c: "2026-11-08T10:00:00.123456+00:00", i: "0e000000-0000-4000-8000-000000000051" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
  it("rejects tampered or garbage cursors instead of throwing", () => {
    expect(decodeCursor("not-base64!")).toBeNull();
    expect(decodeCursor(Buffer.from('{"c":"x","i":"y"}').toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from('{"c":"2026-11-08T10:00:00Z","i":"1,id.gt.0"}').toString("base64url"))).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
});

describe("search pattern", () => {
  it("escapes LIKE wildcards and strips filter syntax", () => {
    expect(toSearchPattern("50%_off")).toBe("%50\\%\\_off%");
    expect(toSearchPattern("a),id.eq.(b")).toBe("%a  id.eq. b%");
  });
});

describe("agency dates", () => {
  it("uses the Sydney calendar day", () => {
    expect(agencyToday(new Date("2026-11-08T14:30:00Z"))).toBe("2026-11-09");
    expect(agencyToday(new Date("2026-11-08T12:59:00Z"))).toBe("2026-11-08");
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-11-28", 6)).toBe("2026-12-04");
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
  });
  it("labels due dates relative to today", () => {
    expect(dueState("2026-11-05", false, "2026-11-08")).toEqual({ text: "3d overdue", tone: "danger" });
    expect(dueState("2026-11-08", false, "2026-11-08").text).toBe("Due today");
    expect(dueState("2026-11-05", true, "2026-11-08").tone).toBe("ok");
  });
});

describe("audit change formatting", () => {
  it("renders per-column diffs", () => {
    expect(describeChanges("update", { status: ["in_progress", "done"], assignee_id: [null, "x"] })).toEqual([
      "status: in progress → done",
      "assignee: empty → x",
    ]);
    expect(describeChanges("insert", { title: "x" })).toEqual([]);
  });
});

describe("API and form schemas", () => {
  it("ignores unknown or malicious filter values instead of failing", () => {
    const f = taskFiltersSchema.parse({ status: "drop table", limit: "100000", assignee: "me" });
    expect(f).toMatchObject({ status: undefined, limit: 25, assignee: "me" });
  });
  it("requires a version for task updates and rejects unknown fields", () => {
    expect(updateTaskSchema.safeParse({ status: "done" }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ version: 2, status: "done", workspace_id: "x" }).success).toBe(false);
    expect(updateTaskSchema.parse({ version: "3", status: "done" }).version).toBe(3);
  });
  it("requires a resolution when resolving a request", () => {
    expect(updateRequestSchema.safeParse({ version: 1, status: "resolved" }).success).toBe(false);
    expect(updateRequestSchema.safeParse({ version: 1, status: "resolved", resolution: "Fixed DNS" }).success).toBe(true);
  });
  it("ties workspace-only visibility to a workspace", () => {
    const base = { categoryId: "0e000000-0000-4000-8000-0000000000b1", title: "Notes", slug: "notes", body: "" };
    expect(articleSchema.safeParse({ ...base, visibility: "workspace" }).success).toBe(false);
    expect(articleSchema.safeParse({ ...base, visibility: "all_staff", workspaceId: "0e000000-0000-4000-8000-0000000000a1" }).success).toBe(false);
  });
});
