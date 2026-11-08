import "server-only";
import type { OpsClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/server-env";
import { dispatchOutbox, type OutboxStore } from "./dispatcher";
import { createMockSender, createSlackSender, type MockScenario, type SlackSender } from "./slack";

/** Live sender if a webhook is configured, otherwise mock mode. */
export function getSender(mockScenario: MockScenario = "ok"): SlackSender {
  return serverEnv.SLACK_WEBHOOK_URL ? createSlackSender(serverEnv.SLACK_WEBHOOK_URL) : createMockSender(mockScenario);
}

export function integrationMode(): "live" | "mock" {
  return serverEnv.SLACK_WEBHOOK_URL ? "live" : "mock";
}

/** Outbox store backed by the lease RPCs, running as the signed-in member. */
export function rpcOutboxStore(supabase: OpsClient): OutboxStore {
  return {
    async claim(limit) {
      const { data, error } = await supabase.rpc("claim_notifications", { p_limit: limit });
      if (error) throw new Error(`claim failed (${error.code})`);
      return data ?? [];
    },
    async complete(i) {
      const { error } = await supabase.rpc("complete_notification", {
        p_id: i.id,
        p_lease: i.lease,
        p_outcome: i.outcome,
        p_http_status: i.httpStatus,
        p_error: i.error,
        p_retry_after_seconds: i.retryAfterSeconds,
        p_mode: i.mode,
      });
      if (error) throw new Error(`complete failed (${error.code})`);
    },
  };
}

export async function processOutbox(supabase: OpsClient, scenario?: MockScenario) {
  return dispatchOutbox(rpcOutboxStore(supabase), getSender(scenario));
}
