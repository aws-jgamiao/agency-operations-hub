import "server-only";
import type { OpsClient } from "@/lib/supabase/server";

/** Workspaces, members and clients visible to the caller (RLS-scoped), for selects and filters. */
export async function getLookups(supabase: OpsClient) {
  const [ws, members, clients, wm] = await Promise.all([
    supabase.from("workspaces").select("id, name, client_id").is("archived_at", null).order("name"),
    supabase.from("members").select("id, full_name, role, active").order("full_name"),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("workspace_members").select("workspace_id, member_id"),
  ]);
  return {
    workspaces: ws.data ?? [],
    members: (members.data ?? []).filter((m) => m.active),
    clients: clients.data ?? [],
    memberships: wm.data ?? [],
  };
}
