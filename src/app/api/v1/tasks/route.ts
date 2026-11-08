import type { NextRequest } from "next/server";
import { authenticate, checkOrigin, json, problem, readJson, validationProblem } from "@/lib/api";
import { listTasks, TASK_COLUMNS } from "@/lib/tasks";
import { createTaskSchema, taskFiltersSchema } from "@/lib/validation/schemas";

/**
 * GET /api/v1/tasks?status=open&priority=high&assignee=me&workspace=<id>&due=overdue&q=form&limit=25&cursor=...
 * Returns { data: Task[], next_cursor: string | null }.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;

  const filters = taskFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const result = await listTasks(auth.supabase, filters, auth.userId);
  if ("error" in result) return problem(500, "Could not load tasks");
  return json({ data: result.items, next_cursor: result.nextCursor });
}

/** POST /api/v1/tasks (admins only; enforced by RLS). */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const csrf = checkOrigin(request, auth);
  if (csrf) return csrf;

  const body = await readJson(request);
  if (body instanceof Response) return body;
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return validationProblem(parsed.error);
  const v = parsed.data;

  const { data, error } = await auth.supabase
    .from("tasks")
    .insert({
      workspace_id: v.workspaceId,
      title: v.title,
      description: v.description,
      status: v.status,
      priority: v.priority,
      assignee_id: v.assigneeId,
      due_date: v.dueDate,
    })
    .select(TASK_COLUMNS)
    .single();

  if (error) {
    if (error.code === "42501") return problem(403, "You can't create tasks in that workspace");
    if (error.code === "23503") return problem(422, "Unknown workspace or assignee");
    return problem(500, "Could not create task");
  }
  return json({ data }, 201);
}
