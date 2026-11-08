import type { Metadata } from "next";
import Link from "next/link";
import { PriorityBadge, RequestStatusBadge } from "@/components/badges";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, REQUEST_STATUS_LABEL } from "@/lib/format";
import { REQUEST_STATUSES } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Client requests" };

const VIEWS = [
  { key: "open", label: "Open" },
  { key: "mine", label: "Assigned to me" },
  { key: "unassigned", label: "Unassigned" },
  { key: "resolved", label: "Resolved & closed" },
] as const;

export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const member = await requireMember();
  const raw = (await searchParams).view;
  const view = VIEWS.find((v) => v.key === raw)?.key ?? "open";
  const supabase = await createClient();

  let query = supabase
    .from("client_requests")
    .select("id, title, status, priority, channel, created_at, client:clients(name), workspace:workspaces(name), assignee:members!client_requests_assignee_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const done = `(${REQUEST_STATUSES.filter((s) => s === "resolved" || s === "closed").join(",")})`;
  if (view === "resolved") query = query.in("status", ["resolved", "closed"]);
  else query = query.not("status", "in", done);
  if (view === "mine") query = query.eq("assignee_id", member.id);
  if (view === "unassigned") query = query.is("assignee_id", null);
  const { data } = await query;

  return (
    <>
      <PageHeader title="Client requests" description="Everything clients have asked for, from first contact to resolution." actions={<LinkButton href="/requests/new">Log request</LinkButton>} />
      <nav aria-label="Request views" className="mb-4 flex flex-wrap gap-2 text-sm">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`/requests?view=${v.key}`} aria-current={view === v.key ? "page" : undefined}
            className={`rounded-md border px-3 py-1 ${view === v.key ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong text-ink-muted hover:bg-surface"}`}>
            {v.label}
          </Link>
        ))}
      </nav>
      {!data?.length ? (
        <EmptyState title="No requests in this view" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">Client requests: {VIEWS.find((v) => v.key === view)?.label}</caption>
            <thead><tr><th scope="col">Request</th><th scope="col">Status</th><th scope="col">Priority</th><th scope="col">Owner</th><th scope="col">Received</th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="font-normal">
                    <Link href={`/requests/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                    <div className="text-xs text-ink-muted">{r.client?.name} · {r.workspace?.name} · via {r.channel}</div>
                  </th>
                  <td><RequestStatusBadge status={r.status} /></td>
                  <td><PriorityBadge priority={r.priority} /></td>
                  <td>{r.assignee?.full_name ?? <span className="text-ink-muted">Unassigned</span>}</td>
                  <td className="whitespace-nowrap text-ink-muted">{formatDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="sr-only">Statuses: {Object.values(REQUEST_STATUS_LABEL).join(", ")}</p>
    </>
  );
}
