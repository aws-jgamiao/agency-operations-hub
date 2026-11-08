import type { NextRequest } from "next/server";
import { authenticate, checkOrigin, json, problem, readJson, validationProblem } from "@/lib/api";
import { TASK_COLUMNS, updateTask, type TaskPatch } from "@/lib/tasks";
import { updateTaskSchema, uuid } from "@/lib/validation/schemas";

type Ctx = RouteContext<"/api/v1/tasks/[id]">;

/** GET /api/v1/tasks/:id → 404 for tasks outside the caller's workspaces (same as non-existent). */
export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const id = uuid.safeParse((await ctx.params).id);
  if (!id.success) return problem(404, "Task not found");

  const { data } = await auth.supabase.from("tasks").select(`${TASK_COLUMNS}, description`).eq("id", id.data).maybeSingle();
  if (!data) return problem(404, "Task not found");
  return json({ data });
}

/**
 * PATCH /api/v1/tasks/:id  { "version": 3, "status": "done" }
 * 200 updated · 404 not visible · 409 stale version · 403 not allowed · 422 invalid.
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const csrf = checkOrigin(request, auth);
  if (csrf) return csrf;
  const id = uuid.safeParse((await ctx.params).id);
  if (!id.success) return problem(404, "Task not found");

  const body = await readJson(request);
  if (body instanceof Response) return body;
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) return validationProblem(parsed.error);

  const { version, assigneeId, dueDate, ...rest } = parsed.data;
  const patch: TaskPatch = { ...rest };
  if ("assigneeId" in (body as object)) patch.assignee_id = assigneeId;
  if ("dueDate" in (body as object)) patch.due_date = dueDate;
  if (Object.keys(patch).length === 0) return problem(422, "Nothing to update");

  const result = await updateTask(auth.supabase, id.data, version, patch);
  if (result.ok) {
    const { data } = await auth.supabase.from("tasks").select(TASK_COLUMNS).eq("id", id.data).single();
    return json({ data });
  }
  switch (result.reason) {
    case "not_found":
      return problem(404, "Task not found");
    case "conflict":
      return problem(409, "The task was changed by someone else", { current_version: result.currentVersion });
    case "forbidden":
      return problem(403, "You can't make that change to this task");
    case "invalid":
      return problem(422, "Invalid value");
    default:
      return problem(500, "Could not update task");
  }
}
