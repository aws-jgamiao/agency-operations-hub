import "server-only";
import type { OpsClient } from "@/lib/supabase/server";
import type { AuditRow } from "@/components/audit-list";

// audit_log.actor_id intentionally has no foreign key (history must survive
// member deletion), so PostgREST can't embed the actor. Resolve names with one
// batched lookup instead of N queries.
export async function withActors<T extends { actor_id: string | null }>(supabase: OpsClient, rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x)))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from("members").select("id, full_name").in("id", ids);
    for (const m of data ?? []) names.set(m.id, m.full_name);
  }
  return rows.map((r) => ({
    ...r,
    actor: r.actor_id ? { full_name: names.get(r.actor_id) ?? "Former member" } : null,
  })) as (T & Pick<AuditRow, "actor">)[];
}

export const AUDIT_COLUMNS = "id, occurred_at, action, entity_type, entity_id, workspace_id, changes, actor_id";
