"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { dbErrorMessage, failure, logDbError, success, type ActionState } from "@/lib/action-state";

export async function resetDemoData(_prev: ActionState): Promise<ActionState> {
  const member = await requireAdmin();
  if (!env.NEXT_PUBLIC_DEMO_MODE || !member.isDemo) return failure("Reset is only available in the demo.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_demo");
  if (error) {
    logDbError("reset_demo", error);
    return failure(dbErrorMessage(error));
  }
  revalidatePath("/", "layout");
  return success("Sample data restored.");
}
