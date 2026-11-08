# Deployment (Vercel + the shared Supabase project)

> Status: **deployed 2026-11-08** to the shared Supabase project and Vercel (https://agency-operations-hub-woad.vercel.app). Steps kept for reference. Every step that changes the remote database is shown for review
> first and is only run with the owner's approval.

## 1. Supabase (shared project): one-time setup

The app only adds the `ops` and `ops_private` schemas. It creates no buckets and alters nothing
that already exists.

1. **Review**, then apply in order, each in a transaction (SQL editor or
   `psql "$DIRECT_URL" --single-transaction -f <file>`):
   - `supabase/migrations/20261108100001_ops_schema.sql`
   - `supabase/migrations/20261108100002_ops_demo.sql`
   - `supabase/migrations/20261108100003_fix_notification_triggers.sql`

   Don't use `supabase db push` here. The shared project's migration history includes other
   apps, so it would report a mismatch.
2. **Data API → Exposed schemas:** add `ops`, keeping the existing entries.
3. **Auth → URL configuration:** add `https://<ops-app>.vercel.app/auth/confirm` to the redirect
   allow-list. Leave the Site URL alone.
4. **Demo accounts:** review, then run `scripts/sql/create-demo-users.sql` (four fixed ids on
   `example.com`, tagged `app = agency-operations-hub`).

## 2. Vercel

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | project URL | public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key | public |
| `NEXT_PUBLIC_SITE_URL` | `https://<ops-app>.vercel.app` | public |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | public |
| `SLACK_WEBHOOK_URL` | *(leave empty for the public demo)* | **server-only secret**. Set it to a webhook from your own test workspace to go live. |

No service-role key is used. Don't add one.

## 3. Smoke checks

- [ ] Demo sign-in as Morgan, Sam and Chris works from `/`.
- [ ] Sam doesn't see Harbour tasks; Chris doesn't see Northwind tasks.
- [ ] `/integrations` shows **Mock mode**, and a simulated 429 is recorded as *rate limited*.
- [ ] `curl /api/v1/tasks` without a token returns 401 with problem+json.
- [ ] "Reset demo data" restores the sample data.

## Rollback

```sql
drop schema ops cascade;
drop schema ops_private cascade;
delete from auth.users where raw_app_meta_data->>'app' = 'agency-operations-hub';
```
