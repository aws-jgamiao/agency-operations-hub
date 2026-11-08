import { describe, expect, it } from "vitest";
import { dispatchOutbox, type OutboxStore } from "./dispatcher";
import type { DeliveryResult, SlackSender } from "./slack";

type Completion = Parameters<OutboxStore["complete"]>[0];

function store(n: number) {
  const completions: Completion[] = [];
  const s: OutboxStore = {
    claim: async () => Array.from({ length: n }, (_, i) => ({ id: i + 1, event_type: "task.assigned", payload: { text: `m${i + 1}` }, attempts: 0, lease_token: `lease-${i + 1}` })),
    complete: async (c) => {
      completions.push(c);
    },
  };
  return { s, completions };
}

function sender(results: DeliveryResult[], mode: "live" | "mock" = "mock"): SlackSender & { sent: string[] } {
  const sent: string[] = [];
  return {
    mode,
    sent,
    async send(p) {
      sent.push(p.text);
      return results[sent.length - 1] ?? { outcome: "sent", httpStatus: 200 };
    },
  };
}

describe("dispatchOutbox", () => {
  it("delivers each claimed message and records the outcome with its lease", async () => {
    const { s, completions } = store(3);
    const summary = await dispatchOutbox(s, sender([]));
    expect(summary).toMatchObject({ claimed: 3, sent: 3, failed: 0, rateLimited: false });
    expect(completions.map((c) => [c.id, c.lease, c.outcome])).toEqual([
      [1, "lease-1", "sent"],
      [2, "lease-2", "sent"],
      [3, "lease-3", "sent"],
    ]);
  });

  it("stops sending after a 429 and releases the rest of the batch", async () => {
    const { s, completions } = store(4);
    const snd = sender([{ outcome: "sent", httpStatus: 200 }, { outcome: "rate_limited", httpStatus: 429, retryAfterSeconds: 20, error: "rl" }]);
    const summary = await dispatchOutbox(s, snd);
    expect(snd.sent).toEqual(["m1", "m2"]); // m3 and m4 never hit Slack
    expect(summary).toMatchObject({ sent: 1, rateLimited: true, released: 2 });
    expect(completions[1]).toMatchObject({ outcome: "rate_limited", retryAfterSeconds: 20, httpStatus: 429 });
    expect(completions.slice(2).map((c) => c.outcome)).toEqual(["release", "release"]);
  });

  it("separates retryable and permanent failures", async () => {
    const { s, completions } = store(2);
    const summary = await dispatchOutbox(
      s,
      sender([
        { outcome: "retry", httpStatus: 503, error: "Slack error 503" },
        { outcome: "failed", httpStatus: 400, error: "invalid_payload" },
      ]),
    );
    expect(summary).toMatchObject({ retrying: 1, failed: 1 });
    expect(completions.map((c) => c.outcome)).toEqual(["retry", "failed"]);
  });

  it("fails malformed payloads without calling Slack", async () => {
    const completions: Completion[] = [];
    const s: OutboxStore = {
      claim: async () => [{ id: 9, event_type: "x", payload: { nope: true }, attempts: 0, lease_token: "l" }],
      complete: async (c) => void completions.push(c),
    };
    const snd = sender([]);
    await dispatchOutbox(s, snd);
    expect(snd.sent).toEqual([]);
    expect(completions[0]).toMatchObject({ outcome: "failed", error: "Malformed payload" });
  });

  it("spaces live messages about a second apart (Slack's limit)", async () => {
    const waits: number[] = [];
    const { s } = store(3);
    await dispatchOutbox(s, sender([], "live"), { sleep: async (ms) => void waits.push(ms) });
    expect(waits).toEqual([1100, 1100]);
  });

  it("records the delivery mode on every completion", async () => {
    const { s, completions } = store(1);
    await dispatchOutbox(s, sender([], "mock"));
    expect(completions[0]?.mode).toBe("mock");
  });
});
