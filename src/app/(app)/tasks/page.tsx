import type { Metadata } from "next";
import Link from "next/link";
import { DueBadge, PriorityBadge, TaskStatusBadge } from "@/components/badges";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks";
import { getLookups } from "@/lib/lookups";
import { agencyToday, dueState, PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/format";
import { taskFiltersSchema } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const member = await requireMember();
  const params = await searchParams;
  const filters = taskFiltersSchema.parse(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const supabase = await createClient();
  const today = agencyToday();
  const [result, lookups] = await Promise.all([listTasks(supabase, filters, member.id, today), getLookups(supabase)]);
  if ("error" in result) throw new Error("Could not load tasks");

  const nextParams = new URLSearchParams(
    Object.entries({ ...filters, cursor: result.nextCursor ?? "" }).filter(([k, v]) => v !== undefined && v !== "" && k !== "limit") as [string, string][],
  );
  const activeFilters = ["status", "priority", "assignee", "workspace", "due", "q"].filter((k) => filters[k as keyof typeof filters]);

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Filter by any combination. The URL keeps your filters, so you can share or bookmark a view."
        actions={member.role === "admin" && <LinkButton href="/tasks/new">New task</LinkButton>}
      />

      <form method="get" className="card mb-4 grid gap-3 p-3 sm:grid-cols-3 lg:grid-cols-7 lg:items-end" aria-label="Filter tasks">
        <Filter label="Search" name="q">
          <input id="f-q" name="q" defaultValue={filters.q ?? ""} placeholder="Title contains…" className="input" />
        </Filter>
        <Filter label="Status" name="status">
          <select id="f-status" name="status" defaultValue={filters.status ?? ""} className="input">
            <option value="">Any</option>
            <option value="open">Open (not done)</option>
            {Object.entries(TASK_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Filter>
        <Filter label="Priority" name="priority">
          <select id="f-priority" name="priority" defaultValue={filters.priority ?? ""} className="input">
            <option value="">Any</option>
            {Object.entries(PRIORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Filter>
        <Filter label="Assignee" name="assignee">
          <select id="f-assignee" name="assignee" defaultValue={filters.assignee ?? ""} className="input">
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
            {lookups.members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </Filter>
        <Filter label="Workspace" name="workspace">
          <select id="f-workspace" name="workspace" defaultValue={filters.workspace ?? ""} className="input">
            <option value="">All mine</option>
            {lookups.workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Filter>
        <Filter label="Due" name="due">
          <select id="f-due" name="due" defaultValue={filters.due ?? ""} className="input">
            <option value="">Any time</option>
            <option value="overdue">Overdue</option>
            <option value="week">Next 7 days</option>
            <option value="none">No due date</option>
          </select>
        </Filter>
        <div className="flex gap-2">
          <button type="submit" className="h-8 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover">Apply</button>
          {activeFilters.length > 0 && <Link href="/tasks" className="inline-flex h-8 items-center rounded-md px-2 text-sm text-ink-muted hover:bg-line/50">Clear</Link>}
        </div>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title={activeFilters.length ? "No tasks match these filters" : "No tasks yet"}>
          {activeFilters.length ? "Try removing a filter." : "Tasks in your workspaces will show up here."}
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">Tasks{filters.cursor ? " (continued)" : ""}</caption>
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
                <th scope="col">Assignee</th>
                <th scope="col">Due</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((t) => (
                <tr key={t.id}>
                  <th scope="row" className="font-normal">
                    <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                    <div className="text-xs text-ink-muted">{t.workspace?.name}</div>
                  </th>
                  <td><TaskStatusBadge status={t.status} /></td>
                  <td><PriorityBadge priority={t.priority} /></td>
                  <td>{t.assignee?.full_name ?? <span className="text-ink-muted">Unassigned</span>}</td>
                  <td><DueBadge due={dueState(t.due_date, t.status === "done", today)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 text-sm">
        {filters.cursor && <Link href={`/tasks?${new URLSearchParams(Object.entries({ ...filters, cursor: "" }).filter(([k, v]) => v && k !== "limit") as [string, string][])}`} className="text-brand-ink underline">Back to first page</Link>}
        {result.nextCursor && <Link href={`/tasks?${nextParams}`} className="text-brand-ink underline">Load more</Link>}
      </div>
    </>
  );
}

function Filter({ label, name, children }: { label: string; name: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={`f-${name}`} className="block text-xs font-medium text-ink-muted">{label}</label>
      {children}
    </div>
  );
}
