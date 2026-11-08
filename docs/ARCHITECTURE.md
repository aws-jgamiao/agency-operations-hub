# Architecture

```
Browser ──> Next.js (Vercel)
             ├─ Server Components         reads (user JWT → RLS)
             ├─ Server Actions            mutations → after(): dispatch outbox
             ├─ /api/v1/* route handlers  REST (bearer or cookie), problem+json
             └─ lib/integrations          Slack sender (live | mock) + dispatcher
                         │ publishable key + user token
                         ▼
             Supabase Postgres (schema ops)
               tables ── RLS ── triggers ─┬─> audit_log (append-only)
                                          └─> notification_outbox ──(claim/lease RPC)──> dispatcher ──> Slack
```

## How this differs from client-portal-mini

| Concern | client-portal-mini | agency-operations-hub |
|---|---|---|
| Isolation unit | organization (external clients) | workspace membership (internal staff) |
| Write control | column grants + RPCs | **field-level trigger guards** by role |
| History | curated activity feed | **generic audit trigger** with per-column JSON diffs |
| Concurrency | last write wins | **optimistic concurrency** (`version`, 409) |
| Interface | Server Actions only | Server Actions **and a typed REST API** sharing one domain module |
| Pagination | keyset on identity | **keyset on (created_at, id)** with opaque cursors |
| External systems | none | **transactional outbox** to Slack with leases, backoff and Retry-After |

## Key decisions

- **Transactional outbox:** notifications are inserted by triggers in the same transaction as the
  change, so a task is never assigned without its notification queued, or vice versa. Delivery
  happens after the response (`after()`), or on demand from the Integrations page.
- **Leases, not locks held over HTTP:** `claim_notifications` uses `FOR UPDATE SKIP LOCKED` to
  mark rows `sending` with a random lease token and a 2-minute expiry. A crashed worker's claim
  simply expires. Completion must present the token.
- **Rate-limit awareness:** a 429 stops the batch and releases the remaining claims, and
  `Retry-After` sets `next_attempt_at`. Transient failures back off exponentially (30 s × 2ⁿ,
  capped at 1 h), and messages give up after 5 attempts. Live sends are spaced about 1.1 s apart
  (Slack's documented limit is roughly 1 message per second per webhook).
- **Mock mode:** with no webhook configured, a mock sender replaces only the HTTP call. Everything
  else (queue, leases, backoff, UI) is the production path, and deliveries are labelled `mock`.
- **One domain module for UI and API:** `src/lib/tasks.ts` holds the listing, filtering, cursor
  and concurrency logic, so `/tasks` and `/api/v1/tasks` can't drift apart.
- **Dates:** "today" and "overdue" use the agency's time zone (`Australia/Sydney`), computed in the
  app and passed to SQL (`task_summary(p_today)`), rather than the database server's UTC
  `current_date`.
- **Cache Components off:** same reasoning as client-portal-mini (ADR 0001).

## Data model

```
members 1─* workspace_members *─1 workspaces *─0..1 clients
workspaces 1─* tasks 1─* task_comments          (FK (task_id, workspace_id))
workspaces 1─* client_requests 1─* request_notes (FK (request_id, workspace_id))
kb_categories 1─* kb_articles *─0..1 workspaces  (visibility: all_staff | admins | workspace)
audit_log            (trigger-written; actor_id without FK)
notification_outbox  (trigger-written; lease columns)
```

Indexes follow the access paths:
- `(assignee_id, status)` for "my work"
- `(workspace_id, status, due_date)` for boards
- a partial index on open tasks' `due_date` for overdue and upcoming
- `(created_at desc, id desc)` for keyset pagination
- `(entity_type, entity_id, id desc)` for per-record history

## Routes

| Route | Who | |
|---|---|---|
| `/dashboard` | all | counts, my tasks, overdue, request summary, recent activity |
| `/tasks`, `/tasks/[id]`, `/tasks/new` | all (create: admin) | filters, history, comments, edit with version |
| `/requests`, `/requests/[id]`, `/requests/new` | all | workflow, notes, resolution |
| `/kb`, `/kb/[slug]`, `/kb/new` | all | role and workspace visibility |
| `/team`, `/audit`, `/integrations` | admin | team access, audit log, Slack |
| `/api/v1/tasks`, `/api/v1/tasks/[id]`, `/api/v1/requests` | authenticated | see API.md |
