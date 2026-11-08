"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { processOutbox } from "@/lib/integrations/outbox";
import { updateTask, type TaskPatch } from "@/lib/tasks";
import { commentSchema, createTaskSchema, updateTaskSchema, uuid } from "@/lib/validation/schemas";
import { dbErrorMessage, failure, logDbError, success, validationFailure, type ActionState } from "@/lib/action-state";

/** Deliver queued Slack notifications after the response is sent. */
function dispatchLater(supabase: Awaited<ReturnType<typeof createClient>>) {
  after(async () => {
    try {
      await processOutbox(supabase);
    } catch (e) {
      console.error(`[outbox] dispatch failed: ${(e as Error).message}`);
    }
  });
}

export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = createTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ workspace_id: v.workspaceId, title: v.title, description: v.description, status: v.status, priority: v.priority, assignee_id: v.assigneeId, due_date: v.dueDate })
    .select("id")
    .single();
  if (error) {
    logDbError("createTask", error);
    return failure(dbErrorMessage(error));
  }
  if (v.assigneeId) dispatchLater(supabase);
  redirect(`/tasks/${data.id}`);
}

export async function saveTask(taskId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const member = await requireMember();
  const id = uuid.safeParse(taskId);
  if (!id.success) return failure("We couldn't find that task.");

  // Staff forms only contain status + description. Even if extra fields are
  // posted, the database trigger rejects staff changes to anything else.
  const raw: Record<string, FormDataEntryValue> = {};
  const allowed = member.role === "admin" ? ["version", "title", "description", "status", "priority", "assigneeId", "dueDate"] : ["version", "description", "status"];
  for (const key of allowed) {
    const value = formData.get(key);
    if (value !== null) raw[key] = value;
  }
  const parsed = updateTaskSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error);

  const { version, assigneeId, dueDate, ...rest } = parsed.data;
  const patch: TaskPatch = { ...rest };
  if ("assigneeId" in raw) patch.assignee_id = assigneeId;
  if ("dueDate" in raw) patch.due_date = dueDate;

  const supabase = await createClient();
  const result = await updateTask(supabase, id.data, version, patch);
  if (!result.ok) {
    switch (result.reason) {
      case "conflict":
        return failure("Someone else saved this task while you were editing. Reload the page to see their changes, then try again.");
      case "not_found":
        return failure("We couldn't find that task.");
      case "forbidden":
        return failure("You can only change the status and description of tasks assigned to you.");
      default:
        logDbError("saveTask", { code: result.code });
        return failure("Some of the values weren't accepted.");
    }
  }
  if ("assignee_id" in patch) dispatchLater(supabase);
  revalidatePath(`/tasks/${id.data}`);
  return success("Task saved.");
}

export async function addComment(taskId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember();
  const id = uuid.safeParse(taskId);
  const parsed = commentSchema.safeParse({ body: formData.get("body") });
  if (!id.success) return failure("We couldn't find that task.");
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("workspace_id").eq("id", id.data).maybeSingle();
  if (!task) return failure("We couldn't find that task.");
  // author_id defaults to auth.uid() in the database and can't be supplied.
  const { error } = await supabase.from("task_comments").insert({ task_id: id.data, workspace_id: task.workspace_id, body: parsed.data.body });
  if (error) {
    logDbError("addComment", error);
    return failure(dbErrorMessage(error));
  }
  revalidatePath(`/tasks/${id.data}`);
  return success("Comment added.");
}

export async function deleteTask(taskId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", uuid.parse(taskId));
  if (error) logDbError("deleteTask", error);
  redirect("/tasks");
}
