"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { clientSchema, uuid, workspaceSchema } from "@/lib/validation/schemas";
import { dbErrorMessage, failure, logDbError, success, validationFailure, type ActionState } from "@/lib/action-state";

export async function setMemberRole(memberId: string, role: "admin" | "staff"): Promise<void> {
  const me = await requireAdmin();
  const id = uuid.parse(memberId);
  if (id === me.id || (role !== "admin" && role !== "staff")) return; // can't demote yourself
  const supabase = await createClient();
  const { error } = await supabase.from("members").update({ role }).eq("id", id);
  if (error) logDbError("setMemberRole", error);
  revalidatePath("/team");
}

export async function setMemberActive(memberId: string, active: boolean): Promise<void> {
  const me = await requireAdmin();
  const id = uuid.parse(memberId);
  if (id === me.id) return; // can't deactivate yourself
  const supabase = await createClient();
  const { error } = await supabase.from("members").update({ active: Boolean(active) }).eq("id", id);
  if (error) logDbError("setMemberActive", error);
  revalidatePath("/team");
}

export async function toggleMembership(workspaceId: string, memberId: string, add: boolean): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const ws = uuid.parse(workspaceId);
  const m = uuid.parse(memberId);
  const { error } = add
    ? await supabase.from("workspace_members").insert({ workspace_id: ws, member_id: m })
    : await supabase.from("workspace_members").delete().eq("workspace_id", ws).eq("member_id", m);
  if (error && error.code !== "23505") logDbError("toggleMembership", error);
  revalidatePath("/team");
}

export async function createWorkspace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = workspaceSchema.safeParse({ name: formData.get("name"), clientId: formData.get("clientId") ?? "" });
  if (!parsed.success) return validationFailure(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").insert({ name: parsed.data.name, client_id: parsed.data.clientId });
  if (error) {
    if (error.code === "23505") return failure("A workspace with that name already exists.");
    logDbError("createWorkspace", error);
    return failure(dbErrorMessage(error));
  }
  revalidatePath("/team");
  return success("Workspace created.");
}

export async function createClientOrg(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = clientSchema.safeParse({ name: formData.get("name"), contactEmail: formData.get("contactEmail") ?? "" });
  if (!parsed.success) return validationFailure(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert({ name: parsed.data.name, contact_email: parsed.data.contactEmail });
  if (error) {
    if (error.code === "23505") return failure("A client with that name already exists.");
    logDbError("createClient", error);
    return failure(dbErrorMessage(error));
  }
  revalidatePath("/team");
  return success("Client added.");
}
