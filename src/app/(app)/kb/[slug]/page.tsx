import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookups } from "@/lib/lookups";
import { formatDateTime } from "@/lib/format";
import { ArticleForm } from "../article-form";
import { updateArticle } from "../actions";

export const metadata: Metadata = { title: "Article" };

export default async function ArticlePage({ params, searchParams }: PageProps<"/kb/[slug]">) {
  const member = await requireMember();
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const editing = (await searchParams).edit === "1";
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("kb_articles")
    .select("id, title, slug, body, visibility, published, category_id, workspace_id, author_id, updated_at, category:kb_categories(name), workspace:workspaces(name), author:members(full_name)")
    .eq("slug", slug)
    .maybeSingle();
  if (!a) notFound(); // restricted articles 404 exactly like missing ones

  const canEdit = member.role === "admin" || a.author_id === member.id;

  if (editing && canEdit) {
    const [{ data: categories }, lookups] = await Promise.all([supabase.from("kb_categories").select("id, name").order("name"), getLookups(supabase)]);
    return (
      <>
        <PageHeader eyebrow={<Link href={`/kb/${a.slug}`} className="underline">{a.title}</Link>} title="Edit article" />
        <Card className="max-w-3xl">
          <ArticleForm
            action={updateArticle.bind(null, a.id)}
            isAdmin={member.role === "admin"}
            categories={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            workspaces={lookups.workspaces.map((w) => ({ value: w.id, label: w.name }))}
            article={a}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={<><Link href="/kb" className="underline">Knowledge base</Link> · {a.category?.name}</>}
        title={a.title}
        description={`${a.author?.full_name ?? "Former member"} · updated ${formatDateTime(a.updated_at)}`}
        actions={canEdit && <Link href={`/kb/${a.slug}?edit=1`} className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-canvas">Edit</Link>}
      />
      <div className="mb-4 flex gap-2">
        {!a.published && <Badge tone="warn">Draft</Badge>}
        {a.visibility === "admins" && <Badge tone="danger">Admins only</Badge>}
        {a.visibility === "workspace" && <Badge tone="info">Only {a.workspace?.name}</Badge>}
      </div>
      <article className="card max-w-3xl space-y-4 p-6 text-[0.9375rem] leading-relaxed">
        {a.body.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="whitespace-pre-line">{para}</p>
        ))}
      </article>
    </>
  );
}
