import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditList } from "@/components/audit-list";
import { PriorityBadge, RequestStatusBadge } from "@/components/badges";
import { ActionForm, SelectField, SubmitButton, TextAreaField } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_COLUMNS, withActors } from "@/lib/audit";
import { getLookups } from "@/lib/lookups";
import { formatDateTime, PRIORITY_LABEL, REQUEST_STATUS_LABEL } from "@/lib/format";
import { uuid } from "@/lib/validation/schemas";
import { addNote, updateRequest } from "../actions";

export const metadata: Metadata = { title: "Client request" };

export default async function RequestPage({ params }: PageProps<"/requests/[id]">) {
  const member = await requireMember();
  const id = uuid.safeParse((await params).id);
  if (!id.success) notFound();
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("client_requests")
    .select("id, title, body, channel, status, priority, resolution, resolved_at, version, created_at, assignee_id, workspace_id, client:clients(name, contact_email), workspace:workspaces(name), assignee:members!client_requests_assignee_id_fkey(full_name)")
    .eq("id", id.data)
    .maybeSingle();
  if (!r) notFound();

  const isAdmin = member.role === "admin";
  const canEdit = isAdmin || r.assignee_id === member.id;
  const [notes, history, lookups] = await Promise.all([
    supabase.from("request_notes").select("id, body, created_at, author:members(full_name)").eq("request_id", r.id).order("created_at"),
    supabase.from("audit_log").select(AUDIT_COLUMNS).eq("entity_type", "client_requests").eq("entity_id", r.id).order("id", { ascending: false }),
    isAdmin ? getLookups(supabase) : null,
  ]);
  const historyRows = await withActors(supabase, history.data ?? []);
  const owners = lookups ? lookups.members.filter((m) => m.role === "admin" || lookups.memberships.some((x) => x.workspace_id === r.workspace_id && x.member_id === m.id)) : [];

  return (
    <>
      <PageHeader
        eyebrow={<><Link href="/requests" className="underline">Client requests</Link> · {r.client?.name} · {r.workspace?.name}</>}
        title={r.title}
        actions={<div className="flex gap-2"><RequestStatusBadge status={r.status} /><PriorityBadge priority={r.priority} /></div>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Request">
            <p className="whitespace-pre-line text-sm">{r.body || <span className="text-ink-muted">No details recorded.</span>}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-ink-muted">Received</dt><dd>{formatDateTime(r.created_at)}</dd></div>
              <div><dt className="text-ink-muted">Channel</dt><dd className="capitalize">{r.channel}</dd></div>
              <div><dt className="text-ink-muted">Owner</dt><dd>{r.assignee?.full_name ?? "Unassigned"}</dd></div>
              <div><dt className="text-ink-muted">Contact</dt><dd className="break-all">{r.client?.contact_email ?? "—"}</dd></div>
            </dl>
            {r.resolution && (
              <div className="mt-4 rounded-md bg-ok-soft p-3 text-sm">
                <p className="font-medium text-ok">Resolution{r.resolved_at ? ` · ${formatDateTime(r.resolved_at)}` : ""}</p>
                <p className="mt-1 whitespace-pre-line">{r.resolution}</p>
              </div>
            )}
          </Card>

          {canEdit ? (
            <Card title="Update">
              <ActionForm action={updateRequest.bind(null, r.id)} className="space-y-4">
                <input type="hidden" name="version" value={r.version} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <SelectField name="status" label="Status" defaultValue={r.status} options={Object.entries(REQUEST_STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
                  {isAdmin && <SelectField name="priority" label="Priority" defaultValue={r.priority} options={Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))} />}
                  {isAdmin && <SelectField name="assigneeId" label="Owner" defaultValue={r.assignee_id ?? ""} options={[{ value: "", label: "Unassigned" }, ...owners.map((m) => ({ value: m.id, label: m.full_name }))]} />}
                </div>
                <TextAreaField name="resolution" label="Resolution" optional hint="Required when marking the request resolved or closed." defaultValue={r.resolution ?? ""} rows={3} maxLength={4000} />
                <SubmitButton>Save</SubmitButton>
              </ActionForm>
            </Card>
          ) : (
            <p className="text-sm text-ink-muted">Only the owner or an admin can change this request. You can still add internal notes.</p>
          )}

          <Card title="Internal notes">
            {notes.data?.length ? (
              <ol className="space-y-3 text-sm">
                {notes.data.map((n) => (
                  <li key={n.id}>
                    <p className="text-ink-muted"><span className="font-medium text-ink">{n.author?.full_name ?? "Former member"}</span> · {formatDateTime(n.created_at)}</p>
                    <p className="whitespace-pre-line">{n.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-muted">No notes yet. Notes are never shown to the client.</p>
            )}
            <ActionForm action={addNote.bind(null, r.id)} resetOnSuccess showSuccess={false} className="mt-4 border-t border-line pt-4">
              <TextAreaField name="body" label="Add an internal note" rows={2} maxLength={4000} />
              <div className="mt-2"><SubmitButton size="sm" pendingText="Adding…">Add note</SubmitButton></div>
            </ActionForm>
          </Card>
        </div>
        <Card title="History"><AuditList rows={historyRows} /></Card>
      </div>
    </>
  );
}
