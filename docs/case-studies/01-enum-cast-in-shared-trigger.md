# Case study: a shared trigger that broke task editing

**Type:** a genuine bug, found by the Playwright suite during development (not a production
incident). **PR:** [docs/pull-requests/0001](../pull-requests/0001-fix-notification-trigger-enum-cast.md)
· commits `eb7be2e` (failing test) and `56838c1` (fix).

## Original problem

Several unrelated-looking E2E tests failed at once:

- "concurrent edits": the *first* save never succeeded, so no conflict could happen.
- "CSRF same-origin create": `POST /api/v1/tasks` returned 500 instead of 201.
- The server log repeated `[db] saveTask failed (code=22P02)`.

Updating only a task's status worked, and the pgTAP suite (41 checks) was green.

## Steps to reproduce (before the fix)

1. `npx supabase db reset`.
2. As `ops-admin@example.com`, create a task with **Assignee: Unassigned**, or open any task
   and click **Save changes** without touching anything.
3. The form shows "Some of the values weren't accepted."

The minimal reproduction over HTTP was:

```js
await admin.from("tasks").update({ status: "blocked" }).eq("id", id);      // OK
await admin.from("tasks").insert({ workspace_id, title: "Repro" });         // 22P02
// invalid input value for enum ops.task_status: "resolved"
```

## Root cause

To save code, one trigger function served two tables:

```sql
if tg_table_name = 'tasks' and new.assignee_id is not null and (...) then
  -- enqueue "task.assigned"
elsif tg_table_name = 'client_requests' and new.status = 'resolved' then
  -- enqueue "request.resolved"
end if;
```

For a trigger on `ops.tasks`, `NEW` has the tasks row type, so `new.status` is
`ops.task_status`. When PL/pgSQL plans the `elsif` expression, the untyped literal `'resolved'` is
coerced to `ops.task_status` and fails. SQL doesn't guarantee short-circuit evaluation, so the
`tg_table_name` guard doesn't help.

The branch is reached whenever the first condition is false:
- inserts with no assignee
- unassigning a task
- **any** update whose SET list contains `assignee_id` without changing it, because the trigger
  is `UPDATE OF assignee_id` and the admin edit form always sends that column

Why the tests missed it: the pgTAP case for notifications only performed a real assignment, which
takes the first branch, and the status-only staff updates don't fire `UPDATE OF assignee_id`.

## Fix

- One trigger function per table (`enqueue_task_notification`, `enqueue_request_notification`),
  so every comparison uses the right type.
- Early returns make the conditions explicit, and an unchanged assignee no longer enqueues a
  notification.
- Shipped as a new migration rather than editing the original, as it would be after a deploy.

## Tests added

- `supabase/tests/database/02_notification_trigger_regression.test.sql`, written first and seen
  failing (3 of 6) before the fix:
  - unassigned insert
  - re-save with the same assignee
  - unassign
  - request resolution still enqueues exactly one notification
- `tests/integration/rls-over-http.test.ts` → the same scenarios through PostgREST.
- The Playwright specs that exposed it (concurrent edit, API create) now pass and guard the UI and
  API paths.

## How regressions are prevented

- **Rule adopted:** trigger functions are table-specific unless every referenced column has the
  same type on every table. Polymorphic triggers like `ops_private.audit()` only use
  `to_jsonb(NEW)` and metadata, which is type-agnostic.
- pgTAP files re-seed inside their transaction, so a test never passes or fails because of
  leftover data. That was a second, smaller problem discovered while reproducing this one.
- CI runs pgTAP, integration and E2E against a fresh local Supabase on every push and PR.
