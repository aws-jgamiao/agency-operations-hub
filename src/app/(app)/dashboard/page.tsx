import type { Metadata } from "next";
import Link from "next/link";
import { AuditList } from "@/components/audit-list";
import { AUDIT_COLUMNS, withActors } from "@/lib/audit";
import { DueBadge, PriorityBadge, RequestStatusBadge } from "@/components/badges";
import { Card, PageHeader, Stat } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, agencyToday, dueState, REQUEST_STATUS_LABEL, type RequestStatus } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const member = await requireMember();
  const supabase = await createClient();
  const today = agencyToday();

  const [summary, myTasks, overdue, requests, recent] = await Promise.all([
    // One SQL round trip for all counts; SECURITY INVOKER so RLS still applies.
    supabase.rpc("task_summary", { p_today: today }),
    supabase
      .from("tasks")
      .select("id, title, priority, due_date, status, workspace:workspaces(name)")
      .eq("assignee_id", member.id)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("tasks")
      .select("id, title, due_date, assignee:members!tasks_assignee_id_fkey(full_name), workspace:workspaces(name)")
      .neq("status", "done")
      .lt("due_date", today)
      .order("due_date")
      .limit(6),
    supabase.from("client_requests").select("status"),
    supabase
      .from("audit_log")
      .select(AUDIT_COLUMNS)
      .order("id", { ascending: false })
      .limit(8),
  ]);

  const recentRows = await withActors(supabase, recent.data ?? []);
  const s = (summary.data ?? {}) as Record<string, number>;
  const byStatus = (requests.data ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const openRequests = (requests.data ?? []).filter((r) => !["resolved", "closed"].includes(r.status)).length;

  return (
    <>
      <PageHeader
        title={`Hi ${member.fullName.split(" ")[0]}`}
        description={member.role === "admin" ? "Everything in flight across the agency." : "Your work across the workspaces you belong to."}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Open tasks" value={s.open ?? 0} />
        <Stat label="Assigned to you" value={s.mine_open ?? 0} />
        <Stat label="Overdue" value={<span className={s.overdue ? "text-danger" : ""}>{s.overdue ?? 0}</span>} />
        <Stat label="Due in 7 days" value={s.due_this_week ?? 0} />
        <Stat label="Open client requests" value={openRequests} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Your open tasks" action={<Link href="/tasks?assignee=me&status=open" className="text-sm text-brand-ink underline">All</Link>} bodyClassName="p-0">
            {!myTasks.data?.length ? (
              <p className="p-5 text-sm text-ink-muted">Nothing assigned to you. Enjoy it while it lasts.</p>
            ) : (
              <table className="data-table">
                <caption className="sr-only">Your open tasks</caption>
                <thead><tr><th scope="col">Task</th><th scope="col">Priority</th><th scope="col">Due</th></tr></thead>
                <tbody>
                  {myTasks.data.map((t) => (
                    <tr key={t.id}>
                      <th scope="row" className="font-normal">
                        <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                        <div className="text-xs text-ink-muted">{t.workspace?.name}</div>
                      </th>
                      <td><PriorityBadge priority={t.priority} /></td>
                      <td><DueBadge due={dueState(t.due_date, false, today)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Overdue" action={<Link href="/tasks?due=overdue" className="text-sm text-brand-ink underline">All</Link>} bodyClassName="p-0">
            {!overdue.data?.length ? (
              <p className="p-5 text-sm text-ink-muted">Nothing overdue.</p>
            ) : (
              <table className="data-table">
                <caption className="sr-only">Overdue tasks</caption>
                <thead><tr><th scope="col">Task</th><th scope="col">Owner</th><th scope="col">Due</th></tr></thead>
                <tbody>
                  {overdue.data.map((t) => (
                    <tr key={t.id}>
                      <th scope="row" className="font-normal">
                        <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                        <div className="text-xs text-ink-muted">{t.workspace?.name}</div>
                      </th>
                      <td>{t.assignee?.full_name ?? <span className="text-ink-muted">Unassigned</span>}</td>
                      <td><DueBadge due={dueState(t.due_date, false, today)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Client requests" action={<Link href="/requests" className="text-sm text-brand-ink underline">Open</Link>}>
            <ul className="space-y-2 text-sm">
              {(Object.keys(REQUEST_STATUS_LABEL) as RequestStatus[]).map((st) => (
                <li key={st} className="flex items-center justify-between">
                  <RequestStatusBadge status={st} />
                  <span className="tabular-nums">{byStatus[st] ?? 0}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Upcoming deadlines">
            <p className="text-sm text-ink-muted">
              {s.due_this_week ?? 0} open tasks are due between today and {addDays(today, 6)}.{" "}
              <Link href="/tasks?due=week" className="text-brand-ink underline">See them</Link>
            </p>
          </Card>
          <Card title="Recent activity">
            <AuditList rows={recentRows} showEntity />
          </Card>
        </div>
      </div>
    </>
  );
}
