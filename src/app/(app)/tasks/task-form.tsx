"use client";

import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import type { ActionState } from "@/lib/action-state";
import { PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/format";

type Option = { value: string; label: string };
const statusOptions: Option[] = Object.entries(TASK_STATUS_LABEL).map(([value, label]) => ({ value, label }));
const priorityOptions: Option[] = Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }));

export function TaskForm({
  action,
  mode,
  workspaces,
  members,
  task,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  mode: "create" | "admin-edit" | "staff-edit";
  workspaces?: Option[];
  members?: Option[];
  task?: { title: string; description: string; status: string; priority: string; assignee_id: string | null; due_date: string | null; version: number };
}) {
  const full = mode !== "staff-edit";
  return (
    <ActionForm action={action} className="space-y-4">
      {task && <input type="hidden" name="version" value={task.version} />}
      {mode === "create" && workspaces && <SelectField name="workspaceId" label="Workspace" options={[{ value: "", label: "Choose…" }, ...workspaces]} />}
      {full && <TextField name="title" label="Title" defaultValue={task?.title} maxLength={160} />}
      <TextAreaField name="description" label="Description" optional defaultValue={task?.description} rows={4} maxLength={8000} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="status" label="Status" options={statusOptions} defaultValue={task?.status ?? "todo"} />
        {full && <SelectField name="priority" label="Priority" options={priorityOptions} defaultValue={task?.priority ?? "medium"} />}
        {full && members && (
          <SelectField name="assigneeId" label="Assignee" options={[{ value: "", label: "Unassigned" }, ...members]} defaultValue={task?.assignee_id ?? ""} />
        )}
        {full && <TextField name="dueDate" label="Due date" type="date" optional defaultValue={task?.due_date ?? ""} />}
      </div>
      {mode === "staff-edit" && (
        <p className="text-sm text-ink-muted">You can update the status and description of tasks assigned to you. Ask an admin to reassign or reschedule.</p>
      )}
      <SubmitButton>{mode === "create" ? "Create task" : "Save changes"}</SubmitButton>
    </ActionForm>
  );
}
