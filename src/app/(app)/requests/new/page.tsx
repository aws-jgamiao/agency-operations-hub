import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLookups } from "@/lib/lookups";
import { PRIORITY_LABEL } from "@/lib/format";
import { createRequest } from "../actions";

export const metadata: Metadata = { title: "Log client request" };

export default async function NewRequestPage() {
  const member = await requireMember();
  const { workspaces, clients, members } = await getLookups(await createClient());
  return (
    <>
      <PageHeader eyebrow={<Link href="/requests" className="underline">Client requests</Link>} title="Log a client request" />
      <Card className="max-w-2xl">
        <ActionForm action={createRequest} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField name="clientId" label="Client" options={[{ value: "", label: "Choose…" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
            <SelectField name="workspaceId" label="Workspace" options={[{ value: "", label: "Choose…" }, ...workspaces.map((w) => ({ value: w.id, label: w.name }))]} />
          </div>
          <TextField name="title" label="Summary" maxLength={160} />
          <TextAreaField name="body" label="Details" optional rows={5} maxLength={8000} />
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField name="channel" label="Received via" options={["email", "phone", "portal", "meeting"].map((c) => ({ value: c, label: c[0]!.toUpperCase() + c.slice(1) }))} />
            <SelectField name="priority" label="Priority" defaultValue="medium" options={Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))} />
            {member.role === "admin" && (
              <SelectField name="assigneeId" label="Owner" optional options={[{ value: "", label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: m.full_name }))]} />
            )}
          </div>
          <SubmitButton>Log request</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
