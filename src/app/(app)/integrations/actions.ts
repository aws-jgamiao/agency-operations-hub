"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { integrationMode, processOutbox } from "@/lib/integrations/outbox";
import type { MockScenario } from "@/lib/integrations/slack";
import { dbErrorMessage, failure, logDbError, success, type ActionState } from "@/lib/action-state";

const SCENARIOS: MockScenario[] = ["ok", "rate_limited", "server_error", "timeout", "invalid_payload"];

function scenarioFrom(formData: FormData): MockScenario {
  const s = formData.get("scenario");
  return SCENARIOS.includes(s as MockScenario) ? (s as MockScenario) : "ok";
}

function describe(r: Awaited<ReturnType<typeof processOutbox>>): string {
  if (r.claimed === 0) return "Nothing was due for delivery.";
  const parts = [`${r.sent} sent`];
  if (r.retrying) parts.push(`${r.retrying} will retry`);
  if (r.failed) parts.push(`${r.failed} failed`);
  if (r.rateLimited) parts.push(`rate limited; ${r.released} held back until Slack allows more`);
  return `Processed ${r.claimed}: ${parts.join(", ")}.`;
}

export async function sendTestNotification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("enqueue_test_notification");
  if (error) {
    logDbError("enqueue_test_notification", error);
    return failure(dbErrorMessage(error));
  }
  try {
    const result = await processOutbox(supabase, scenarioFrom(formData));
    revalidatePath("/integrations");
    return success(`${integrationMode() === "mock" ? "[Mock mode] " : ""}${describe(result)}`);
  } catch (e) {
    console.error(`[outbox] ${(e as Error).message}`);
    return failure("The queue couldn't be processed. Try again.");
  }
}

export async function processQueueNow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  try {
    const result = await processOutbox(supabase, scenarioFrom(formData));
    revalidatePath("/integrations");
    return success(describe(result));
  } catch (e) {
    console.error(`[outbox] ${(e as Error).message}`);
    return failure("The queue couldn't be processed. Try again.");
  }
}

export async function retryNotification(id: number): Promise<void> {
  await requireAdmin();
  if (!Number.isSafeInteger(id) || id <= 0) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("retry_notification", { p_id: id });
  if (error) logDbError("retry_notification", error);
  revalidatePath("/integrations");
}
