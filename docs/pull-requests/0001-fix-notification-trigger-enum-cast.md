# PR: Fix task writes failing with 22P02 in the notification trigger

**Branch:** `fix/notification-trigger-enum-cast` → `main` (merged with `--no-ff`)
**Type:** bug fix (database) · **Risk:** low

> This is the description for the PR. GitHub wasn't connected while this was developed, so the
> branch was merged locally. The same text should be used when the repository is published.

## What changed

- `supabase/migrations/20261108100003_fix_notification_triggers.sql`: replaces the shared
  `ops_private.enqueue_notifications()` with `enqueue_task_notification()` and
  `enqueue_request_notification()`, one per table, and recreates the two triggers.
- `supabase/tests/database/02_notification_trigger_regression.test.sql`: new regression suite.
- `supabase/tests/database/*.test.sql`: each file now re-seeds inside its transaction, so results
  don't depend on earlier runs.
- `tests/integration/rls-over-http.test.ts`: the same scenarios over PostgREST.

## Why

Admins couldn't create an unassigned task, unassign a task, or save the edit form at all (the form
always sends `assignee_id`). The UI said "Some of the values weren't accepted." The API returned
500. The server log showed `saveTask failed (code=22P02)`.

Root cause: in a trigger function, `NEW` has the row type of the table that fired it. The shared
function's second branch compared `new.status = 'resolved'`. When it fired on `ops.tasks`,
Postgres resolved `'resolved'` as an `ops.task_status` value, which doesn't exist:

```
ERROR 22P02: invalid input value for enum ops.task_status: "resolved"
```

That branch is only reached when the task branch doesn't return first. The original pgTAP test
only covered a real assignment change, so it never reached the faulty branch.

## How it was tested

| Check | Before | After |
|---|---|---|
| `npm run test:db` (regression file) | 3 of 6 failed with 22P02 | 47 of 47 pass |
| `npm run test:integration` | n/a | 6 of 6 pass |
| Playwright: concurrent-edit, CSRF same-origin create, Slack assignment specs | failed (500 / no save) | pass |

## Risks and rollout

- Drops and recreates two triggers inside one migration (transactional), so there's no window
  where writes skip notifications.
- Behaviour change: re-saving a task without changing the assignee no longer enqueues a
  notification. That's intended; previously it would have announced a non-event.
- Rollback: re-apply the previous function from `20261108100001_ops_schema.sql`. That would bring
  the bug back, so a forward fix is preferred.
