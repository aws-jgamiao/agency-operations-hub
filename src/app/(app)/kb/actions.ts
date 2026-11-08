"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { articleSchema, uuid } from "@/lib/validation/schemas";
import { dbErrorMessage, failure, logDbError, validationFailure, type ActionState } from "@/lib/action-state";

function parse(formData: FormData) {
  return articleSchema.safeParse({
    categoryId: formData.get("categoryId"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    body: formData.get("body") ?? "",
    visibility: formData.get("visibility"),
    workspaceId: formData.get("workspaceId") ?? "",
    published: formData.get("published") ?? "",
  });
}

function row(v: ReturnType<typeof articleSchema.parse>) {
  return { category_id: v.categoryId, title: v.title, slug: v.slug, body: v.body, visibility: v.visibility, workspace_id: v.workspaceId, published: v.published };
}

function mapError(error: { code?: string }) {
  if (error.code === "23505") return failure("That slug is already used by another article.", { slug: ["Choose a different slug."] });
  if (error.code === "42501") return failure("You can't publish with that visibility.");
  return failure(dbErrorMessage(error));
}

export async function createArticle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const member = await requireMember();
  const parsed = parse(formData);
  if (!parsed.success) return validationFailure(parsed.error);
  if (member.role !== "admin" && parsed.data.visibility === "admins") return failure("Only admins can publish admin-only articles.");
  const supabase = await createClient();
  const { error } = await supabase.from("kb_articles").insert(row(parsed.data));
  if (error) {
    logDbError("createArticle", error);
    return mapError(error);
  }
  redirect(`/kb/${parsed.data.slug}`);
}

export async function updateArticle(articleId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember();
  const id = uuid.safeParse(articleId);
  const parsed = parse(formData);
  if (!id.success) return failure("We couldn't find that article.");
  if (!parsed.success) return validationFailure(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("kb_articles").update(row(parsed.data)).eq("id", id.data).select("slug");
  if (error) {
    logDbError("updateArticle", error);
    return mapError(error);
  }
  if (!data.length) return failure("Only the author or an admin can edit this article.");
  revalidatePath("/kb");
  redirect(`/kb/${parsed.data.slug}`);
}
