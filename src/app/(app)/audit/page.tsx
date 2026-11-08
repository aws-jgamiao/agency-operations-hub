import type { Metadata } from "next";
import Link from "next/link";
import { describeChanges } from "@/components/audit-list";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_COLUMNS, withActors } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

const TYPES = ["tasks", "client_requests", "kb_articles", "workspaces", "clients", "members"] as const;
const PAGE = 50;

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  await requireAdmin();
  const sp = await searchParams;
  const type = TYPES.find((t) => t === sp.type) ?? null;
  const before = typeof sp.before === "string" && /^\d{1,18}$/.test(sp.before) ? Number(sp.before) : null;
  const supabase = await createClient();

  let q = supabase.from("audit_log").select(AUDIT_COLUMNS).order("id", { ascending: false }).limit(PAGE + 1);
  if (type) q = q.eq("entity_type", type);
  if (before) q = q.lt("id", before);
  const { data } = await q;
  const rows = await withActors(supabase, (data ?? []).slice(0, PAGE));
  const more = (data?.length ?? 0) > PAGE;

  return (
    <>
      <PageHeader title="Audit log" description="Written by database triggers. Append-only: no one, admins included, can change or delete entries." />
      <nav aria-label="Filter by record type" className="mb-4 flex flex-wrap gap-2 text-sm">
        {[null, ...TYPES].map((t) => (
          <Link key={t ?? "all"} href={t ? `/audit?type=${t}` : "/audit"} aria-current={type === t ? "page" : undefined}
            className={`rounded-md border px-3 py-1 ${type === t ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong text-ink-muted hover:bg-surface"}`}>
            {t ? t.replace("_", " ") : "All"}
          </Link>
        ))}
      </nav>
      {!rows.length ? <EmptyState title="No entries" /> : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">Audit entries, newest first</caption>
            <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Record</th><th scope="col">Changes</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const lines = describeChanges(r.action, r.changes);
                const title = (r.changes as { title?: string; name?: string } | null);
                const href = r.entity_type === "tasks" ? `/tasks/${r.entity_id}` : r.entity_type === "client_requests" ? `/requests/${r.entity_id}` : null;
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-ink-muted">{formatDateTime(r.occurred_at)}</td>
                    <td>{r.actor?.full_name ?? "System"}</td>
                    <td className="capitalize">{r.action}</td>
                    <th scope="row" className="font-normal">
                      {href && r.action !== "delete" ? <Link href={href} className="underline">{r.entity_type.replace("_", " ")}</Link> : r.entity_type.replace("_", " ")}
                      {r.action !== "update" && (title?.title || title?.name) && <div className="text-xs text-ink-muted">{title.title ?? title.name}</div>}
                    </th>
                    <td className="font-mono text-xs text-ink-muted">{lines.length ? lines.map((l) => <div key={l}>{l}</div>) : r.action === "update" ? "" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {more && rows.at(-1) && (
        <Link href={`/audit?${new URLSearchParams({ ...(type ? { type } : {}), before: String(rows.at(-1)!.id) })}`} className="mt-4 inline-block text-sm text-brand-ink underline">Older entries</Link>
      )}
    </>
  );
}
