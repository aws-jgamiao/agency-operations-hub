"use client";

import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import type { ActionState } from "@/lib/action-state";

type Opt = { value: string; label: string };

export function ArticleForm({
  action,
  categories,
  workspaces,
  isAdmin,
  article,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  categories: Opt[];
  workspaces: Opt[];
  isAdmin: boolean;
  article?: { title: string; slug: string; body: string; category_id: string; visibility: string; workspace_id: string | null; published: boolean };
}) {
  const visibility: Opt[] = [
    { value: "all_staff", label: "Everyone on the team" },
    { value: "workspace", label: "One workspace only" },
    ...(isAdmin ? [{ value: "admins", label: "Admins only" }] : []),
  ];
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="title" label="Title" defaultValue={article?.title} maxLength={160} />
        <TextField name="slug" label="URL slug" defaultValue={article?.slug} hint="e.g. deploy-checklist" maxLength={80} />
        <SelectField name="categoryId" label="Category" defaultValue={article?.category_id} options={categories} />
        <SelectField name="visibility" label="Who can read it" defaultValue={article?.visibility ?? "all_staff"} options={visibility} />
        <SelectField name="workspaceId" label="Workspace" optional hint="Only for workspace-only articles." defaultValue={article?.workspace_id ?? ""} options={[{ value: "", label: "None" }, ...workspaces]} />
      </div>
      <TextAreaField name="body" label="Content" rows={12} defaultValue={article?.body} maxLength={20000} hint="Plain text. Blank lines separate paragraphs." />
      <CheckboxField name="published" label="Published" hint="Drafts are only visible to you and admins." defaultChecked={article?.published ?? false} />
      <SubmitButton>{article ? "Save article" : "Create article"}</SubmitButton>
    </ActionForm>
  );
}
