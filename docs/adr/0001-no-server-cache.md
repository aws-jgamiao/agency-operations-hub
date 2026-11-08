# ADR 0001: Cache Components disabled; every page renders per request

**Status:** accepted · 2026-11-08

## Context

Next.js 16 scaffolds new apps with `cacheComponents: true`. That model prerenders a static shell
and caches data with `use cache`, keyed by its inputs. Every page in this app shows
workspace-scoped data, fetched with the signed-in user's JWT so that Postgres RLS can filter it.

## Decision

Set `cacheComponents: false`. Pages read the session cookie and query Supabase on every request.
There is no server-side data cache.

## Consequences

- **No cross-workspace cache risk.** A cached result can't be served to the wrong user because of a
  mistaken cache key. RLS stays the single source of truth for what a user can see.
- **Mutations are immediately visible.** No cache tags to invalidate, beyond `revalidatePath` for
  the router cache.
- **Cost:** no static shell for authenticated pages. At this scale (a handful of queries per page,
  run in parallel with `Promise.all`), that's acceptable.
- **If it's ever revisited:** cache only data that isn't tenant-specific, or use
  `use cache: private`, which caches in the browser only.
