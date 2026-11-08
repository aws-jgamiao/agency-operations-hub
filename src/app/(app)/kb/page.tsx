import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Knowledge base" };

export default async function KbPage() {
  await requireMember();
  const supabase = await createClient();
  // RLS returns only what this person may read: published all-staff articles,
  // their workspaces' articles, their own drafts, and (admins) everything.
  const [{ data: categories }, { data: articles }] = await Promise.all([
    supabase.from("kb_categories").select("id, name").order("name"),
    supabase
      .from("kb_articles")
      .select("id, title, slug, visibility, published, updated_at, category_id, workspace:workspaces(name), author:members(full_name)")
      .order("title"),
  ]);

  return (
    <>
      <PageHeader title="Knowledge base" description="Training material and how-tos. You only see articles you have access to." actions={<LinkButton href="/kb/new">New article</LinkButton>} />
      {!articles?.length ? (
        <EmptyState title="No articles yet" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {(categories ?? []).map((c) => {
            const list = articles.filter((a) => a.category_id === c.id);
            if (!list.length) return null;
            return (
              <section key={c.id} aria-labelledby={`cat-${c.id}`} className="card p-4">
                <h2 id={`cat-${c.id}`} className="mb-3 font-semibold">{c.name}</h2>
                <ul className="space-y-3">
                  {list.map((a) => (
                    <li key={a.id}>
                      <Link href={`/kb/${a.slug}`} className="font-medium hover:underline">{a.title}</Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                        {!a.published && <Badge tone="warn">Draft</Badge>}
                        {a.visibility === "admins" && <Badge tone="danger">Admins only</Badge>}
                        {a.visibility === "workspace" && <Badge tone="info">{a.workspace?.name}</Badge>}
                        <span>{a.author?.full_name} · {formatDateTime(a.updated_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
