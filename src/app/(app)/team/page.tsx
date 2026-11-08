import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createClientOrg, createWorkspace, setMemberActive, setMemberRole, toggleMembership } from "./actions";

export const metadata: Metadata = { title: "Team & workspaces" };

export default async function TeamPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const [{ data: members }, { data: workspaces }, { data: memberships }, { data: clients }] = await Promise.all([
    supabase.from("members").select("id, full_name, email, role, active").order("full_name"),
    supabase.from("workspaces").select("id, name, client:clients(name)").is("archived_at", null).order("name"),
    supabase.from("workspace_members").select("workspace_id, member_id"),
    supabase.from("clients").select("id, name, contact_email").order("name"),
  ]);
  const isIn = (w: string, m: string) => (memberships ?? []).some((x) => x.workspace_id === w && x.member_id === m);

  return (
    <>
      <PageHeader title="Team & workspaces" description="Roles, access and which workspaces each person works in. Every change is written to the audit log." />
      <Card title="People and workspace access" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">Team members, roles and workspace access</caption>
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Role</th>
                {(workspaces ?? []).map((w) => <th key={w.id} scope="col">{w.name}</th>)}
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.id} className={m.active ? "" : "opacity-60"}>
                  <th scope="row" className="font-normal">
                    <span className="font-medium">{m.full_name}</span>
                    <div className="text-xs text-ink-muted">{m.email}</div>
                  </th>
                  <td>
                    {m.id === me.id ? <Badge tone="brand">Admin (you)</Badge> : (
                      <form action={setMemberRole.bind(null, m.id, m.role === "admin" ? "staff" : "admin")}>
                        <Button type="submit" variant="ghost" size="sm">{m.role === "admin" ? "Admin" : "Staff"} · change<span className="sr-only"> role for {m.full_name}</span></Button>
                      </form>
                    )}
                  </td>
                  {(workspaces ?? []).map((w) => {
                    const member = isIn(w.id, m.id);
                    return (
                      <td key={w.id}>
                        {m.role === "admin" ? <span className="text-xs text-ink-muted">All (admin)</span> : (
                          <form action={toggleMembership.bind(null, w.id, m.id, !member)}>
                            <button type="submit" role="switch" aria-checked={member} aria-label={`${m.full_name} in ${w.name}`}
                              className={`h-6 w-11 rounded-full p-0.5 transition-colors ${member ? "bg-brand" : "bg-line-strong"}`}>
                              <span className={`block size-5 rounded-full bg-white shadow transition-transform ${member ? "translate-x-5" : ""}`} />
                            </button>
                          </form>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    {m.id === me.id ? <span className="text-xs text-ink-muted">—</span> : (
                      <form action={setMemberActive.bind(null, m.id, !m.active)}>
                        <Button type="submit" variant={m.active ? "ghost" : "secondary"} size="sm">
                          {m.active ? "Deactivate" : "Reactivate"}<span className="sr-only"> {m.full_name}</span>
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Workspaces">
          <ul className="mb-4 space-y-1 text-sm">
            {(workspaces ?? []).map((w) => <li key={w.id}><span className="font-medium">{w.name}</span>{w.client && <span className="text-ink-muted"> · {w.client.name}</span>}</li>)}
          </ul>
          <ActionForm action={createWorkspace} resetOnSuccess className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <TextField name="name" label="New workspace" maxLength={80} />
            <SelectField name="clientId" label="Client" optional options={[{ value: "", label: "Internal" }, ...(clients ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
            <SubmitButton size="sm">Create</SubmitButton>
          </ActionForm>
        </Card>
        <Card title="Clients">
          <ul className="mb-4 space-y-1 text-sm">
            {(clients ?? []).map((c) => <li key={c.id}><span className="font-medium">{c.name}</span>{c.contact_email && <span className="text-ink-muted"> · {c.contact_email}</span>}</li>)}
          </ul>
          <ActionForm action={createClientOrg} resetOnSuccess className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <TextField name="name" label="Client name" maxLength={120} />
            <TextField name="contactEmail" label="Contact email" type="email" optional />
            <SubmitButton size="sm">Add</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
