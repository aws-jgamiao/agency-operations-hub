import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditList } from "@/components/audit-list";
import { DueBadge, PriorityBadge, TaskStatusBadge } from "@/components/badges";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, SubmitButton, TextAreaField } from "@/components/ui/form";
import { Avatar, Card, PageHeader } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_COLUMNS, withActors } from "@/lib/audit";
import { getLookups } from "@/lib/lookups";
import { agencyToday, dueState, formatDate, formatDateTime } from "@/lib/format";
import { uuid } from "@/lib/validation/schemas";
import { addComment, deleteTask, saveTask } from "../actions";
import { TaskForm } from "../task-form";

export const metadata: Metadata = { title: "Task" };

export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const member = await requireMember();
  const id = uuid.safeParse((await params).id);
  if (!id.success) notFound();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_date, version, created_at, workspace_id, assignee_id, workspace:workspaces(id, name), assignee:members!tasks_assignee_id_fkey(full_name), creator:members!tasks_created_by_fkey(full_name)")
    .eq("id", id.data)
    .maybeSingle();
  if (!task) notFound(); // outside your workspaces looks exactly like non-existent

  const [comments, history, lookups] = await Promise.all([
    supabase.from("task_comments").select("id, body, created_at, author:members(full_name)").eq("task_id", task.id).order("created_at"),
    supabase.from("audit_log").select(AUDIT_COLUMNS).eq("entity_type", "tasks").eq("entity_id", task.id).order("id", { ascending: false }).limit(30),
    member.role === "admin" ? getLookups(supabase) : null,
  ]);
  const historyRows = await withActors(supabase, history.data ?? []);

  const isAdmin = member.role === "admin";
  const canEdit = isAdmin || task.assignee_id === member.id;
  const wsMembers = lookups
    ? lookups.members.filter((m) => m.role === "admin" || lookups.memberships.some((x) => x.workspace_id === task.workspace_id && x.member_id === m.id))
    : [];

  return (
    <>
      <PageHeader
        eyebrow={<><Link href="/tasks" className="underline">Tasks</Link> · {task.workspace?.name}</>}
        title={task.title}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <DueBadge due={dueState(task.due_date, task.status === "done", agencyToday())} />
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Details">
            <p className="whitespace-pre-line text-sm">{task.description || <span className="text-ink-muted">No description.</span>}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-ink-muted">Assignee</dt><dd>{task.assignee?.full_name ?? "Unassigned"}</dd></div>
              <div><dt className="text-ink-muted">Due</dt><dd>{formatDate(task.due_date)}</dd></div>
              <div><dt className="text-ink-muted">Created by</dt><dd>{task.creator?.full_name ?? "—"}</dd></div>
              <div><dt className="text-ink-muted">Version</dt><dd className="font-mono">{task.version}</dd></div>
            </dl>
          </Card>

          {canEdit ? (
            <Card title="Update task">
              <TaskForm
                action={saveTask.bind(null, task.id)}
                mode={isAdmin ? "admin-edit" : "staff-edit"}
                members={wsMembers.map((m) => ({ value: m.id, label: m.full_name }))}
                task={{ ...task, description: task.description }}
              />
              {isAdmin && (
                <form action={deleteTask.bind(null, task.id)} className="mt-5 border-t border-line pt-4">
                  <ConfirmSubmit message={`Delete "${task.title}"?`} variant="danger" size="sm">Delete task</ConfirmSubmit>
                </form>
              )}
            </Card>
          ) : (
            <p className="text-sm text-ink-muted">Only the assignee or an admin can update this task.</p>
          )}

          <Card title={`Comments (${comments.data?.length ?? 0})`}>
            {comments.data?.length ? (
              <ol className="space-y-4">
                {comments.data.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <Avatar name={c.author?.full_name ?? "?"} size="sm" />
                    <div className="text-sm">
                      <p className="text-ink-muted"><span className="font-medium text-ink">{c.author?.full_name ?? "Former member"}</span> · {formatDateTime(c.created_at)}</p>
                      <p className="mt-0.5 whitespace-pre-line">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-muted">No comments yet.</p>
            )}
            <ActionForm action={addComment.bind(null, task.id)} resetOnSuccess showSuccess={false} className="mt-5 border-t border-line pt-4">
              <TextAreaField name="body" label="Add a comment" rows={2} maxLength={4000} />
              <div className="mt-2"><SubmitButton size="sm" pendingText="Posting…">Comment</SubmitButton></div>
            </ActionForm>
          </Card>
        </div>
        <Card title="History">
          <AuditList rows={historyRows} />
        </Card>
      </div>
    </>
  );
}
