// Outbox dispatcher. Claims due notifications (lease-based, so concurrent
// runs never double-send), delivers them one at a time, and records each
// outcome. On a 429 it stops the batch and releases the remaining claims,
// because sending more would only extend Slack's rate limit.
import type { SlackSender } from "./slack";

type Claimed = { id: number; event_type: string; payload: unknown; attempts: number; lease_token: string };

export interface OutboxStore {
  claim(limit: number): Promise<Claimed[]>;
  complete(input: {
    id: number;
    lease: string;
    outcome: "sent" | "rate_limited" | "retry" | "failed" | "release";
    httpStatus?: number;
    error?: string;
    retryAfterSeconds?: number;
    mode: "live" | "mock";
  }): Promise<void>;
}

export type DispatchSummary = { claimed: number; sent: number; retrying: number; failed: number; rateLimited: boolean; released: number };

function textOf(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "text" in payload && typeof (payload as { text: unknown }).text === "string") {
    return (payload as { text: string }).text;
  }
  return null;
}

export async function dispatchOutbox(
  store: OutboxStore,
  sender: SlackSender,
  { limit = 10, spacingMs = 1100, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)) } = {},
): Promise<DispatchSummary> {
  const batch = await store.claim(limit);
  const summary: DispatchSummary = { claimed: batch.length, sent: 0, retrying: 0, failed: 0, rateLimited: false, released: 0 };

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i]!;

    if (summary.rateLimited) {
      await store.complete({ id: item.id, lease: item.lease_token, outcome: "release", mode: sender.mode });
      summary.released++;
      continue;
    }

    const text = textOf(item.payload);
    if (!text) {
      await store.complete({ id: item.id, lease: item.lease_token, outcome: "failed", error: "Malformed payload", mode: sender.mode });
      summary.failed++;
      continue;
    }

    const result = await sender.send({ text });
    await store.complete({
      id: item.id,
      lease: item.lease_token,
      outcome: result.outcome,
      httpStatus: "httpStatus" in result ? result.httpStatus : undefined,
      error: "error" in result ? result.error : undefined,
      retryAfterSeconds: result.outcome === "rate_limited" ? result.retryAfterSeconds : undefined,
      mode: sender.mode,
    });

    if (result.outcome === "sent") summary.sent++;
    else if (result.outcome === "retry") summary.retrying++;
    else if (result.outcome === "failed") summary.failed++;
    else summary.rateLimited = true;

    // Slack allows about one message per second per webhook.
    if (sender.mode === "live" && i < batch.length - 1 && !summary.rateLimited) await sleep(spacingMs);
  }
  return summary;
}
