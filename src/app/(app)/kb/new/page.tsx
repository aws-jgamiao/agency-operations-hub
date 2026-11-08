import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookups } from "@/lib/lookups";
import { ArticleForm } from "../article-form";
import { createArticle } from "../actions";

export const metadata: Metadata = { title: "New article" };

export default async function NewArticlePage() {
  const member = await requireMember();
  const supabase = await createClient();
  const [{ data: categories }, lookups] = await Promise.all([supabase.from("kb_categories").select("id, name").order("name"), getLookups(supabase)]);
  return (
    <>
      <PageHeader eyebrow={<Link href="/kb" className="underline">Knowledge base</Link>} title="New article" />
      <Card className="max-w-3xl">
        <ArticleForm
          action={createArticle}
          isAdmin={member.role === "admin"}
          categories={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
          workspaces={lookups.workspaces.map((w) => ({ value: w.id, label: w.name }))}
        />
      </Card>
    </>
  );
}
