# REST API (v1)

Base path: `/api/v1`. JSON in and out, errors as `application/problem+json` (RFC 9457).

## Authentication

Either:
- `Authorization: Bearer <Supabase access token>` (scripts, curl), or
- the browser session cookie (same-origin requests from the app).

Every request runs with the caller's own token, so **Postgres RLS decides what is visible**:
staff see only their workspaces, and admins see everything. Cookie-authenticated `POST`/`PATCH`
requests must send an `Origin` header matching the site, or they get 403 (CSRF protection).

Get a token for a demo account:

```bash
curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"ops-sam@example.com","password":"DemoOps!2026"}' | jq -r .access_token
```

## Endpoints

### `GET /api/v1/tasks`

| Query | Values |
|---|---|
| `status` | `todo`, `in_progress`, `blocked`, `done`, `open` (not done) |
| `priority` | `low`, `medium`, `high`, `urgent` |
| `assignee` | `me`, `unassigned`, or a member id |
| `workspace` | workspace id |
| `due` | `overdue`, `week` (next 7 days), `none` |
| `q` | title contains (LIKE wildcards are escaped) |
| `limit` | 1–100 (default 25) |
| `cursor` | opaque value from `next_cursor` |

Invalid filter values are ignored rather than rejected, so links never break.
Response: `{ "data": Task[], "next_cursor": string | null }`.

Pagination is **keyset** on `(created_at, id)`: stable when rows are inserted between pages, and
index-backed (`tasks_created_keyset_idx`).

### `POST /api/v1/tasks` (admins)

```json
{ "workspaceId": "uuid", "title": "string", "description": "", "status": "todo",
  "priority": "medium", "assigneeId": "uuid|null", "dueDate": "YYYY-MM-DD|null" }
```

Returns `201 { data: Task }`. Staff get `403`.

### `GET /api/v1/tasks/:id`

Returns `200 { data }`, or `404` if the task doesn't exist **or** is outside your workspaces. The
two cases are indistinguishable.

### `PATCH /api/v1/tasks/:id`

```json
{ "version": 3, "status": "done" }
```

`version` is required (**optimistic concurrency**). Unknown fields are rejected.

| Status | Meaning |
|---|---|
| 200 | updated; body has the new `version` |
| 404 | not visible to you |
| 409 | stale `version`; body includes `current_version` |
| 403 | not allowed (e.g. staff changing priority/assignee, or not the assignee) |
| 422 | validation failed; `errors: [{ path, message }]` |

### `GET /api/v1/requests?status=open&limit=50`

Client requests in your workspaces. `status` takes any request status or `open`.

## Error format

```json
{ "type": "about:blank", "title": "The task was changed by someone else", "status": 409, "current_version": 4 }
```

Messages are deliberately generic: database details are never returned.
