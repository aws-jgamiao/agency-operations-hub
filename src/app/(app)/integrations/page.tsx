import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { ActionForm, SelectField, SubmitButton } from "@/components/ui/form";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { integrationMode } from "@/lib/integrations/outbox";
import { formatDateTime } from "@/lib/format";
import { processQueueNow, retryNotification, sendTestNotification } from "./actions";

export const metadata: Metadata = { title: "Integrations" };

const STATUS_TONE = { pending: "neutral", sending: "info", sent: "ok", rate_limited: "warn", failed: "danger" } as const;

const SCENARIOS = [
  { value: "ok", label: "Slack accepts it (200)" },
  { value: "rate_limited", label: "Rate limited (429, Retry-After: 45)" },
  { value: "server_error", label: "Slack outage (503)" },
  { value: "timeout", label: "Request times out" },
  { value: "invalid_payload", label: "Rejected (400 invalid_payload)" },
];

export default async function IntegrationsPage() {
  await requireAdmin();
  const mode = integrationMode();
  const supabase = await createClient();
  const { data: log } = await supabase
    .from("notification_outbox")
    .select("id, event_type, payload, status, attempts, last_http_status, last_error, delivery_mode, created_at, sent_at, next_attempt_at")
    .order("id", { ascending: false })
    .limit(50);

  return (
    <>
      <PageHeader title="Integrations" description="Slack notifications for task assignments and resolved client requests." />

      <div className={`mb-6 rounded-[var(--radius-card)] border p-4 text-sm ${mode === "mock" ? "border-warn/30 bg-warn-soft" : "border-ok/30 bg-ok-soft"}`}>
        {mode === "mock" ? (
          <>
            <p className="font-semibold text-warn">Mock mode: nothing is sent to Slack</p>
            <p className="mt-1 text-ink">
              No webhook is configured, so deliveries are recorded here and marked <em>mock</em>. The queue, retries, backoff and
              rate-limit handling are the real code paths. You can pick which Slack response to simulate below. To send for real,
              set <code className="font-mono">SLACK_WEBHOOK_URL</code> on the server.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-ok">Live: connected to a Slack incoming webhook</p>
            <p className="mt-1 text-ink">The webhook URL is a server-side secret and is never shown or sent to the browser.</p>
          </>
        )}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Send a test notification">
          <ActionForm action={sendTestNotification} className="space-y-3">
            {mode === "mock" && <SelectField name="scenario" label="Simulated Slack response" options={SCENARIOS} />}
            <SubmitButton pendingText="Sending…">Queue and deliver test message</SubmitButton>
          </ActionForm>
        </Card>
        <Card title="Delivery queue">
          <p className="mb-3 text-sm text-ink-muted">
            New notifications are delivered right after the change that caused them. Use this to process anything that&apos;s waiting
            on a retry.
          </p>
          <ActionForm action={processQueueNow} className="space-y-3">
            {mode === "mock" && <SelectField name="scenario" label="Simulated Slack response" options={SCENARIOS} />}
            <SubmitButton variant="secondary" pendingText="Processing…">Process due notifications</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      <Card title="Delivery log" bodyClassName="p-0">
        {!log?.length ? <div className="p-5"><EmptyState title="No notifications yet" /></div> : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Notification delivery log, newest first</caption>
              <thead><tr><th scope="col">Message</th><th scope="col">Status</th><th scope="col">Attempts</th><th scope="col">Last result</th><th scope="col">Queued</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {log.map((n) => {
                  const text = (n.payload as { text?: string } | null)?.text ?? "";
                  return (
                    <tr key={n.id}>
                      <th scope="row" className="max-w-md font-normal">
                        <span className="line-clamp-2">{text}</span>
                        <div className="text-xs text-ink-muted">{n.event_type}{n.delivery_mode === "mock" ? " · mock" : ""}</div>
                      </th>
                      <td><Badge tone={STATUS_TONE[n.status]}>{n.status.replace("_", " ")}</Badge></td>
                      <td className="tabular-nums">{n.attempts}</td>
                      <td className="text-xs">
                        {n.last_http_status && <span className="font-mono">HTTP {n.last_http_status} </span>}
                        {n.last_error && <span className="text-ink-muted">{n.last_error}</span>}
                        {(n.status === "rate_limited" || (n.status === "pending" && n.attempts > 0)) && (
                          <div className="text-ink-muted">Next try {formatDateTime(n.next_attempt_at)}</div>
                        )}
                        {n.sent_at && <div className="text-ink-muted">Delivered {formatDateTime(n.sent_at)}</div>}
                      </td>
                      <td className="whitespace-nowrap text-ink-muted">{formatDateTime(n.created_at)}</td>
                      <td>
                        {n.status === "failed" && (
                          <form action={retryNotification.bind(null, n.id)}>
                            <Button type="submit" variant="secondary" size="sm">Retry<span className="sr-only"> notification {n.id}</span></Button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
