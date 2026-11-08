# Security model

An internal tool where the important boundaries are **workspaces** (staff only see the client work
they're assigned to), **roles** (admin vs staff), and **history** (nobody can rewrite what
happened).

| Layer | Enforces | Where |
|---|---|---|
| RLS | Every table: workspace membership via `ops_private.my_workspaces()`; admin via `is_admin()`. Deactivated members lose access immediately. | `supabase/migrations/20261108100001_ops_schema.sql` |
| Field-level trigger | Staff may change only `status`/`description` on their own tasks. Assignee, workspace, priority, title and due date are admin-only. Requests can only be reassigned by admins. | `guard_staff_task_update`, `before_request_write` |
| Column grants | `created_by`, `author_id` and outbox state can't be written by clients (DB defaults to `auth.uid()`). | "Privileges" section |
| Composite FKs | Comments and notes must reference a task or request **in the same workspace**. | `task_comments`, `request_notes` |
| Audit log | Written only by a `SECURITY DEFINER` trigger. No API role has INSERT, UPDATE or DELETE, admins included. `actor_id` has no FK so history survives member deletion. | `ops_private.audit()` |
| Server code | `requireMember` / `requireAdmin` (verified with `getUser()`), Zod on every input, bound ids re-validated, and staff forms only forward allowed fields. | `src/lib/auth.ts`, `src/app/**/actions.ts` |
| API | Bearer or cookie auth verified per request, Origin check on cookie writes, problem+json without internals, `.strict()` bodies. | `src/lib/api.ts` |

## Secrets

| Secret | Where it lives | Exposure |
|---|---|---|
| Supabase publishable key | `NEXT_PUBLIC_*` | public by design; RLS protects data |
| `SLACK_WEBHOOK_URL` | server env only, read via `src/lib/server-env.ts` (`import "server-only"`) | never in the bundle, never rendered, never logged |
| Service-role key | **not used anywhere** | — |

The webhook URL is validated to be `https://hooks.slack.com/services/...`. Requests use
`redirect: "error"` and a 5-second timeout, so a misconfigured value can't turn the server into a
proxy (SSRF).

## Privileged functions

| Function | Caller | Check | Purpose |
|---|---|---|---|
| `is_admin`, `is_member`, `my_workspaces` | policies | — | avoid recursive RLS |
| `task_summary(date)` | members | **SECURITY INVOKER** (RLS applies) | dashboard counts |
| `claim_notifications`, `complete_notification` | active members | membership; completion needs the lease token | outbox delivery without a service key |
| `retry_notification`, `enqueue_test_notification` | admins | `is_admin()` | integrations page |
| `reset_demo` | demo admins | role, `is_demo` and active | restore sample data |
| `audit`, `enqueue_*_notification`, guards | triggers | — | history, outbox, field rules |

**Known trade-off:** any active member can call the claim/complete RPCs, because deliveries are
triggered by whoever made the change. A malicious insider could mark notifications as sent.
Notification contents are generated in SQL, so they can't be forged. Moving delivery to a
scheduled worker with its own credential would close this; see "Future work" in the README.

## Shared Supabase project

The demo is deployed into a Supabase project shared with the owner's other apps:
- Everything lives in `ops` / `ops_private`, with nothing created in `public`.
- Auth cleanup on reset filters on `raw_app_meta_data.app = 'agency-operations-hub'` plus fixed
  ids. pgTAP asserts that an untagged user survives a reset.

Shared auth settings and quotas are accepted residual risks (see `../../PLAN.md`).

## Tests that prove it

- pgTAP (47 checks), covering:
  - workspace scoping
  - staff field limits
  - audit immutability and diffs
  - outbox leases and Retry-After scheduling
  - KB visibility
  - deactivation
  - grants
  - reset scope
  - the trigger regression
- Integration: the same boundaries over PostgREST with real JWTs.
- E2E/API: 401, 404 for other workspaces, 409, 403 for staff, 422, CSRF, admin-route 404s, and
  lock-out on deactivation.
