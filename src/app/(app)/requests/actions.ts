"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { processOutbox } from "@/lib/integrations/outbox";
import { commentSchema, createRequestSchema, updateRequestSchema, uuid } from "@/lib/validation/schemas";
import { dbErrorMessage, failure, logDbError, success, validationFailure, type ActionState } from "@/lib/action-state";

export async function createRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const member = await requireMember();
  const parsed = createRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_requests")
    .insert({
      client_id: v.clientId,
      workspace_id: v.workspaceId,
      title: v.title,
      body: v.body,
      channel: v.channel,
      priority: v.priority,
      // Only admins choose the owner; staff-logged requests start unassigned.
      assignee_id: member.role === "admin" ? v.assigneeId : null,
    })
    .select("id")
    .single();
  if (error) {
    logDbError("createRequest", error);
    return failure(dbErrorMessage(error));
  }
  redirect(`/requests/${data.id}`);
}

export async function updateRequest(requestId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const member = await requireMember();
  const id = uuid.safeParse(requestId);
  if (!id.success) return failure("We couldn't find that request.");
  const raw = Object.fromEntries(formData);
  if (member.role !== "admin") {
    delete raw.assigneeId;
    delete raw.priority;
  }
  const parsed = updateRequestSchema.safeParse(raw);
  if (!parsed.success) return validationFailure(parsed.error);
  const v = parsed.data;

  const patch: { status: typeof v.status; resolution: string | null; assignee_id?: string | null; priority?: typeof v.priority } = {
    status: v.status,
    resolution: v.resolution,
  };
  if (member.role === "admin") {
    patch.assignee_id = v.assigneeId;
    if (v.priority) patch.priority = v.priority;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_requests")
    .update(patch)
    .eq("id", id.data)
    .eq("version", v.version)
    .select("id")
    .maybeSingle();
  if (error) {
    logDbError("updateRequest", error);
    return failure(error.code === "42501" ? "Only the assignee or an admin can update this request." : dbErrorMessage(error));
  }
  if (!data) {
    const { data: current } = await supabase.from("client_requests").select("version").eq("id", id.data).maybeSingle();
    if (current && current.version !== v.version) return failure("Someone else updated this request. Reload to see the latest version.");
    return failure(current ? "Only the assignee or an admin can update this request." : "We couldn't find that request.");
  }
  if (v.status === "resolved") {
    after(async () => {
      try {
        await processOutbox(supabase);
      } catch (e) {
        console.error(`[outbox] dispatch failed: ${(e as Error).message}`);
      }
    });
  }
  revalidatePath(`/requests/${id.data}`);
  return success("Request updated.");
}

export async function addNote(requestId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember();
  const id = uuid.safeParse(requestId);
  const parsed = commentSchema.safeParse({ body: formData.get("body") });
  if (!id.success) return failure("We couldn't find that request.");
  if (!parsed.success) return validationFailure(parsed.error);
  const supabase = await createClient();
  const { data: req } = await supabase.from("client_requests").select("workspace_id").eq("id", id.data).maybeSingle();
  if (!req) return failure("We couldn't find that request.");
  const { error } = await supabase.from("request_notes").insert({ request_id: id.data, workspace_id: req.workspace_id, body: parsed.data.body });
  if (error) {
    logDbError("addNote", error);
    return failure(dbErrorMessage(error));
  }
  revalidatePath(`/requests/${id.data}`);
  return success("Note added.");
}
