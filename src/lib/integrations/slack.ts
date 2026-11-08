// Slack incoming-webhook client. Pure module (no Next.js imports) so it can be
// unit-tested with a mocked fetch.

export type SlackPayload = { text: string };

export type DeliveryResult =
  | { outcome: "sent"; httpStatus: number }
  | { outcome: "rate_limited"; httpStatus: 429; retryAfterSeconds: number; error: string }
  | { outcome: "retry"; httpStatus?: number; error: string }      // transient: 5xx, timeout, network
  | { outcome: "failed"; httpStatus?: number; error: string };    // permanent: bad URL, 4xx

export interface SlackSender {
  readonly mode: "live" | "mock";
  send(payload: SlackPayload): Promise<DeliveryResult>;
}

const MAX_TEXT = 3000;

/** Slack treats <, > and & as control characters (mentions, links). Escape user text so a title like "<!channel>" stays literal. */
export function escapeSlackText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const DEFAULT_RETRY_AFTER = 30;

/** Only real Slack webhook hosts over HTTPS: prevents the server from being used to reach other URLs (SSRF). */
export function isAllowedWebhookUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === "hooks.slack.com" && url.pathname.startsWith("/services/");
  } catch {
    return false;
  }
}

export function parseRetryAfter(header: string | null): number {
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(Math.ceil(seconds), 3600);
  return DEFAULT_RETRY_AFTER;
}

export function createSlackSender(
  webhookUrl: string,
  { fetchImpl = fetch, timeoutMs = 5000 }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): SlackSender {
  return {
    mode: "live",
    async send(payload) {
      if (!isAllowedWebhookUrl(webhookUrl)) {
        return { outcome: "failed", error: "Webhook URL is not a Slack incoming-webhook URL" };
      }
      let res: Response;
      try {
        res = await fetchImpl(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: escapeSlackText(payload.text.slice(0, MAX_TEXT)) }),
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "error",
        });
      } catch (e) {
        const name = (e as Error).name;
        return { outcome: "retry", error: name === "TimeoutError" ? `Timed out after ${timeoutMs} ms` : "Network error" };
      }

      if (res.ok) return { outcome: "sent", httpStatus: res.status };
      // Slack returns short plain-text error codes such as "invalid_payload" or "no_service".
      const body = (await res.text().catch(() => "")).slice(0, 120);
      if (res.status === 429) {
        return { outcome: "rate_limited", httpStatus: 429, retryAfterSeconds: parseRetryAfter(res.headers.get("retry-after")), error: "Rate limited by Slack" };
      }
      if (res.status >= 500) return { outcome: "retry", httpStatus: res.status, error: `Slack error ${res.status}` };
      return { outcome: "failed", httpStatus: res.status, error: `Slack rejected the message (${res.status}${body ? `: ${body}` : ""})` };
    },
  };
}

export type MockScenario = "ok" | "rate_limited" | "server_error" | "timeout" | "invalid_payload";

/**
 * Mock mode: used when no webhook is configured (the public demo). Nothing
 * leaves the server, and the UI labels these deliveries "mock". A scenario
 * can be chosen to demonstrate the failure paths end to end.
 */
export function createMockSender(scenario: MockScenario = "ok"): SlackSender {
  return {
    mode: "mock",
    async send() {
      switch (scenario) {
        case "ok":
          return { outcome: "sent", httpStatus: 200 };
        case "rate_limited":
          return { outcome: "rate_limited", httpStatus: 429, retryAfterSeconds: 45, error: "Rate limited by Slack (simulated)" };
        case "server_error":
          return { outcome: "retry", httpStatus: 503, error: "Slack error 503 (simulated)" };
        case "timeout":
          return { outcome: "retry", error: "Timed out after 5000 ms (simulated)" };
        case "invalid_payload":
          return { outcome: "failed", httpStatus: 400, error: "Slack rejected the message (400: invalid_payload) (simulated)" };
      }
    },
  };
}
