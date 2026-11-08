import { formatDateTime } from "@/lib/format";

export type AuditRow = {
  id: number;
  occurred_at: string;
  action: string;
  entity_type: string;
  changes: unknown;
  actor: { full_name: string } | null;
};

const ENTITY_LABEL: Record<string, string> = {
  tasks: "task",
  client_requests: "request",
  kb_articles: "article",
  workspaces: "workspace",
  clients: "client",
  members: "member",
};

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "empty";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s.replaceAll("_", " ");
}

/** Renders {"status": ["todo", "done"]} as readable "status: todo → done". */
export function describeChanges(action: string, changes: unknown): string[] {
  if (action !== "update" || !changes || typeof changes !== "object") return [];
  return Object.entries(changes as Record<string, unknown>).map(([key, pair]) => {
    const [from, to] = Array.isArray(pair) ? pair : [undefined, pair];
    return `${key.replace(/_id$/, "").replaceAll("_", " ")}: ${fmt(from)} → ${fmt(to)}`;
  });
}

export function AuditList({ rows, showEntity = false }: { rows: AuditRow[]; showEntity?: boolean }) {
  if (!rows.length) return <p className="text-sm text-ink-muted">No history yet.</p>;
  return (
    <ol className="space-y-3">
      {rows.map((r) => {
        const lines = describeChanges(r.action, r.changes);
        const title = (r.changes as { title?: string } | null)?.title;
        return (
          <li key={r.id} className="text-sm">
            <p>
              <span className="font-medium">{r.actor?.full_name ?? "System"}</span>{" "}
              <span className="text-ink-muted">
                {r.action === "insert" ? "created" : r.action === "delete" ? "deleted" : "updated"}
                {showEntity ? ` ${ENTITY_LABEL[r.entity_type] ?? r.entity_type}` : ""}
                {r.action !== "update" && typeof title === "string" ? ` "${title}"` : ""} ·{" "}
                <time dateTime={r.occurred_at}>{formatDateTime(r.occurred_at)}</time>
              </span>
            </p>
            {lines.length > 0 && (
              <ul className="mt-0.5 font-mono text-xs text-ink-muted">
                {lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
