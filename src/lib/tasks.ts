import "server-only";
import type { OpsClient } from "@/lib/supabase/server";
import { decodeCursor, encodeCursor, toSearchPattern } from "@/lib/cursor";
import { addDays, agencyToday } from "@/lib/format";
import type { TaskFilters } from "@/lib/validation/schemas";

// Shared by the Tasks pages (Server Components/Actions) and the REST API,
// so both behave identically. Every query runs under the caller's RLS.

export const TASK_COLUMNS =
  "id, title, status, priority, due_date, version, created_at, updated_at, workspace:workspaces(id, name), assignee:members!tasks_assignee_id_fkey(id, full_name)";

export async function listTasks(supabase: OpsClient, filters: TaskFilters, viewerId: string, today = agencyToday()) {
  let query = supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(filters.limit + 1);

  if (filters.status === "open") query = query.neq("status", "done");
  else if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.workspace) query = query.eq("workspace_id", filters.workspace);
  if (filters.assignee === "me") query = query.eq("assignee_id", viewerId);
  else if (filters.assignee === "unassigned") query = query.is("assignee_id", null);
  else if (filters.assignee) query = query.eq("assignee_id", filters.assignee);
  if (filters.due === "overdue") query = query.lt("due_date", today).neq("status", "done");
  if (filters.due === "week") query = query.gte("due_date", today).lte("due_date", addDays(today, 6)).neq("status", "done");
  if (filters.due === "none") query = query.is("due_date", null);
  if (filters.q) query = query.ilike("title", toSearchPattern(filters.q));

  const cursor = decodeCursor(filters.cursor);
  if (cursor) {
    query = query.or(`created_at.lt."${cursor.c}",and(created_at.eq."${cursor.c}",id.lt.${cursor.i})`);
  }

  const { data, error } = await query;
  if (error) return { error } as const;
  const hasMore = data.length > filters.limit;
  const items = data.slice(0, filters.limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor({ c: last.created_at, i: last.id }) : null,
  } as const;
}

export type TaskPatch = Partial<{
  title: string;
  description: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assignee_id: string | null;
  due_date: string | null;
}>;

export type UpdateResult =
  | { ok: true; task: { id: string; version: number } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; currentVersion: number }
  | { ok: false; reason: "forbidden" | "invalid" | "error"; code?: string };

/**
 * Optimistic concurrency: the update only applies if the row still has the
 * version the caller read. 0 rows => either someone else changed it (409) or
 * the caller can't see/edit it (404); we re-read to tell which, under RLS.
 */
export async function updateTask(supabase: OpsClient, id: string, version: number, patch: TaskPatch): Promise<UpdateResult> {
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .eq("version", version)
    .select("id, version")
    .maybeSingle();

  if (error) {
    if (error.code === "42501") return { ok: false, reason: "forbidden", code: error.code };
    if (error.code?.startsWith("22") || error.code?.startsWith("23")) return { ok: false, reason: "invalid", code: error.code };
    return { ok: false, reason: "error", code: error.code };
  }
  if (data) return { ok: true, task: data };

  const { data: current } = await supabase.from("tasks").select("version, assignee_id").eq("id", id).maybeSingle();
  if (!current) return { ok: false, reason: "not_found" };
  if (current.version !== version) return { ok: false, reason: "conflict", currentVersion: current.version };
  // Visible, same version, but RLS refused the update: not the assignee.
  return { ok: false, reason: "forbidden" };
}
