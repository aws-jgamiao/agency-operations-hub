-- =============================================================================
-- Agency Operations Hub: internal operations schema.
--
-- Shared-project isolation: everything lives in `ops` (exposed) and
-- `ops_private` (never exposed). Nothing is created in `public`, and auth.users
-- is only touched for rows tagged raw_app_meta_data.app = 'agency-operations-hub'.
--
-- Roles: admin (everything) and staff (work inside the workspaces they belong to).
-- =============================================================================

create schema ops;
create schema ops_private;
comment on schema ops is 'Agency Operations Hub: API-exposed tables (RLS on every table).';
comment on schema ops_private is 'Agency Operations Hub: helpers, triggers, audit. Never exposed.';

create type ops.member_role     as enum ('admin', 'staff');
create type ops.task_status     as enum ('todo', 'in_progress', 'blocked', 'done');
create type ops.priority        as enum ('low', 'medium', 'high', 'urgent');
create type ops.request_status  as enum ('new', 'triaged', 'in_progress', 'waiting_on_client', 'resolved', 'closed');
create type ops.kb_visibility   as enum ('all_staff', 'admins', 'workspace');
create type ops.outbox_status   as enum ('pending', 'sending', 'sent', 'rate_limited', 'failed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table ops.members (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null check (char_length(email) <= 254),
  full_name   text not null check (char_length(btrim(full_name)) between 1 and 120),
  role        ops.member_role not null default 'staff',
  active      boolean not null default true,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table ops.clients (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique check (char_length(btrim(name)) between 2 and 120),
  contact_email  text check (contact_email is null or contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  created_at     timestamptz not null default now()
);

create table ops.workspaces (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique check (char_length(btrim(name)) between 2 and 80),
  client_id    uuid references ops.clients (id) on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table ops.workspace_members (
  workspace_id  uuid not null references ops.workspaces (id) on delete cascade,
  member_id     uuid not null references ops.members (id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (workspace_id, member_id)
);
create index workspace_members_member_idx on ops.workspace_members (member_id);

create table ops.tasks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references ops.workspaces (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 2 and 160),
  description   text not null default '' check (char_length(description) <= 8000),
  status        ops.task_status not null default 'todo',
  priority      ops.priority not null default 'medium',
  assignee_id   uuid references ops.members (id) on delete set null,
  due_date      date,
  completed_at  timestamptz,
  version       integer not null default 1,      -- optimistic concurrency
  created_by    uuid default auth.uid() references ops.members (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint tasks_completed_consistent check ((status = 'done') = (completed_at is not null)),
  constraint tasks_id_workspace_key unique (id, workspace_id)
);
-- Access paths: "my open work", workspace boards, overdue/upcoming, keyset list.
create index tasks_assignee_status_idx on ops.tasks (assignee_id, status);
create index tasks_workspace_status_due_idx on ops.tasks (workspace_id, status, due_date);
create index tasks_open_due_idx on ops.tasks (due_date) where status <> 'done';
create index tasks_created_keyset_idx on ops.tasks (created_at desc, id desc);

create table ops.task_comments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null,
  workspace_id  uuid not null,
  author_id     uuid default auth.uid() references ops.members (id) on delete set null,
  body          text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at    timestamptz not null default now(),
  constraint task_comments_task_fk foreign key (task_id, workspace_id)
    references ops.tasks (id, workspace_id) on delete cascade
);
create index task_comments_task_idx on ops.task_comments (task_id, created_at);

create table ops.client_requests (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references ops.clients (id) on delete cascade,
  workspace_id  uuid not null references ops.workspaces (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 2 and 160),
  body          text not null default '' check (char_length(body) <= 8000),
  channel       text not null default 'email' check (channel in ('email', 'phone', 'portal', 'meeting')),
  status        ops.request_status not null default 'new',
  priority      ops.priority not null default 'medium',
  assignee_id   uuid references ops.members (id) on delete set null,
  resolution    text check (resolution is null or char_length(resolution) <= 4000),
  resolved_at   timestamptz,
  version       integer not null default 1,
  created_by    uuid default auth.uid() references ops.members (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint requests_resolution_required check (
    status not in ('resolved', 'closed') or char_length(btrim(coalesce(resolution, ''))) > 0
  ),
  constraint requests_id_workspace_key unique (id, workspace_id)
);
create index requests_workspace_status_idx on ops.client_requests (workspace_id, status);
create index requests_assignee_status_idx on ops.client_requests (assignee_id, status);

create table ops.request_notes (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null,
  workspace_id  uuid not null,
  author_id     uuid default auth.uid() references ops.members (id) on delete set null,
  body          text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at    timestamptz not null default now(),
  constraint request_notes_request_fk foreign key (request_id, workspace_id)
    references ops.client_requests (id, workspace_id) on delete cascade
);
create index request_notes_request_idx on ops.request_notes (request_id, created_at);

create table ops.kb_categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null unique check (char_length(btrim(name)) between 2 and 60),
  slug  text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table ops.kb_articles (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references ops.kb_categories (id) on delete restrict,
  workspace_id  uuid references ops.workspaces (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 2 and 160),
  slug          text not null unique check (char_length(slug) <= 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  body          text not null default '' check (char_length(body) <= 20000),
  visibility    ops.kb_visibility not null default 'all_staff',
  published     boolean not null default false,
  author_id     uuid default auth.uid() references ops.members (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint kb_workspace_scope check ((visibility = 'workspace') = (workspace_id is not null))
);
create index kb_articles_category_idx on ops.kb_articles (category_id);

-- Append-only audit trail. No API role has INSERT/UPDATE/DELETE on it.
create table ops.audit_log (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  actor_id      uuid,                        -- no FK: history survives member deletion
  action        text not null check (action in ('insert', 'update', 'delete')),
  entity_type   text not null,
  entity_id     uuid not null,
  workspace_id  uuid,
  changes       jsonb not null default '{}'::jsonb
);
create index audit_entity_idx on ops.audit_log (entity_type, entity_id, id desc);
create index audit_workspace_idx on ops.audit_log (workspace_id, id desc);

-- Transactional outbox for Slack notifications (written by triggers).
create table ops.notification_outbox (
  id               bigint generated always as identity primary key,
  event_type       text not null,
  workspace_id     uuid,
  payload          jsonb not null,
  status           ops.outbox_status not null default 'pending',
  attempts         integer not null default 0 check (attempts >= 0),
  next_attempt_at  timestamptz not null default now(),
  lease_token      uuid,
  lease_expires_at timestamptz,
  last_error       text check (last_error is null or char_length(last_error) <= 500),
  last_http_status integer,
  delivery_mode    text check (delivery_mode is null or delivery_mode in ('live', 'mock')),
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);
create index outbox_due_idx on ops.notification_outbox (next_attempt_at) where status in ('pending', 'rate_limited');

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------
create function ops_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select m.role = 'admin' and m.active from ops.members m where m.id = (select auth.uid())), false)
$$;

create function ops_private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from ops.members m where m.id = (select auth.uid()) and m.active)
$$;

-- Workspaces the caller belongs to (admins: all). Returned as an array so
-- policies can use `= any(...)` and Postgres evaluates it once per statement.
create function ops_private.my_workspaces() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select case
    when ops_private.is_admin() then array(select w.id from ops.workspaces w)
    else array(
      select wm.workspace_id from ops.workspace_members wm
      join ops.members m on m.id = wm.member_id
      where wm.member_id = (select auth.uid()) and m.active)
  end
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table ops.members             enable row level security;
alter table ops.clients             enable row level security;
alter table ops.workspaces          enable row level security;
alter table ops.workspace_members   enable row level security;
alter table ops.tasks               enable row level security;
alter table ops.task_comments       enable row level security;
alter table ops.client_requests     enable row level security;
alter table ops.request_notes       enable row level security;
alter table ops.kb_categories       enable row level security;
alter table ops.kb_articles         enable row level security;
alter table ops.audit_log           enable row level security;
alter table ops.notification_outbox enable row level security;

-- Team directory and clients: visible to active members; managed by admins.
create policy members_select on ops.members for select to authenticated using ((select ops_private.is_member()));
create policy members_admin_write on ops.members for update to authenticated
  using ((select ops_private.is_admin())) with check ((select ops_private.is_admin()));

create policy clients_select on ops.clients for select to authenticated using ((select ops_private.is_member()));
create policy clients_insert on ops.clients for insert to authenticated with check ((select ops_private.is_admin()));
create policy clients_update on ops.clients for update to authenticated
  using ((select ops_private.is_admin())) with check ((select ops_private.is_admin()));

create policy workspaces_select on ops.workspaces for select to authenticated
  using (id = any ((select ops_private.my_workspaces())::uuid[]));
create policy workspaces_insert on ops.workspaces for insert to authenticated with check ((select ops_private.is_admin()));
create policy workspaces_update on ops.workspaces for update to authenticated
  using ((select ops_private.is_admin())) with check ((select ops_private.is_admin()));

create policy wm_select on ops.workspace_members for select to authenticated
  using (workspace_id = any ((select ops_private.my_workspaces())::uuid[]));
create policy wm_insert on ops.workspace_members for insert to authenticated with check ((select ops_private.is_admin()));
create policy wm_delete on ops.workspace_members for delete to authenticated using ((select ops_private.is_admin()));

-- Tasks: visible inside your workspaces. Admins create/delete; the assignee
-- (or an admin) updates. A trigger limits WHICH fields staff may change.
create policy tasks_select on ops.tasks for select to authenticated
  using (workspace_id = any ((select ops_private.my_workspaces())::uuid[]));
create policy tasks_insert on ops.tasks for insert to authenticated with check ((select ops_private.is_admin()));
create policy tasks_update on ops.tasks for update to authenticated
  using ((select ops_private.is_admin()) or (assignee_id = (select auth.uid()) and workspace_id = any ((select ops_private.my_workspaces())::uuid[])))
  with check ((select ops_private.is_admin()) or (assignee_id = (select auth.uid()) and workspace_id = any ((select ops_private.my_workspaces())::uuid[])));
create policy tasks_delete on ops.tasks for delete to authenticated using ((select ops_private.is_admin()));

create policy task_comments_select on ops.task_comments for select to authenticated
  using (workspace_id = any ((select ops_private.my_workspaces())::uuid[]));
create policy task_comments_insert on ops.task_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and workspace_id = any ((select ops_private.my_workspaces())::uuid[]));

-- Client requests: workspace members log and see them; assignee or admin updates.
create policy requests_select on ops.client_requests for select to authenticated
  using (workspace_id = any ((select ops_private.my_workspaces())::uuid[]));
create policy requests_insert on ops.client_requests for insert to authenticated
  with check (workspace_id = any ((select ops_private.my_workspaces())::uuid[]));
create policy requests_update on ops.client_requests for update to authenticated
  using ((select ops_private.is_admin()) or (assignee_id = (select auth.uid()) and workspace_id = any ((select ops_private.my_workspaces())::uuid[])))
  with check ((select ops_private.is_admin()) or (assignee_id = (select auth.uid()) and workspace_id = any ((select ops_private.my_workspaces())::uuid[])));
create policy requests_delete on ops.client_requests for delete to authenticated using ((select ops_private.is_admin()));

create policy request_notes_select on ops.request_notes for select to authenticated
  using (workspace_id = any ((select ops_private.my_workspaces())::uuid[]));
create policy request_notes_insert on ops.request_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and workspace_id = any ((select ops_private.my_workspaces())::uuid[]));

-- Knowledge base.
create policy kb_categories_select on ops.kb_categories for select to authenticated using ((select ops_private.is_member()));
create policy kb_categories_write on ops.kb_categories for insert to authenticated with check ((select ops_private.is_admin()));

create policy kb_articles_select on ops.kb_articles for select to authenticated
  using (
    (select ops_private.is_admin())
    or ((select ops_private.is_member()) and author_id = (select auth.uid()))
    or ((select ops_private.is_member()) and published and (
          visibility = 'all_staff'
          or (visibility = 'workspace' and workspace_id = any ((select ops_private.my_workspaces())::uuid[]))))
  );
create policy kb_articles_insert on ops.kb_articles for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select ops_private.is_member())
    and ((select ops_private.is_admin()) or visibility <> 'admins')
    and (visibility <> 'workspace' or workspace_id = any ((select ops_private.my_workspaces())::uuid[]))
  );
create policy kb_articles_update on ops.kb_articles for update to authenticated
  using ((select ops_private.is_admin()) or (author_id = (select auth.uid()) and (select ops_private.is_member())))
  with check (
    (select ops_private.is_admin())
    or (author_id = (select auth.uid()) and visibility <> 'admins'
        and (visibility <> 'workspace' or workspace_id = any ((select ops_private.my_workspaces())::uuid[])))
  );
create policy kb_articles_delete on ops.kb_articles for delete to authenticated
  using ((select ops_private.is_admin()) or author_id = (select auth.uid()));

-- Audit: admins see everything; staff see history for their workspaces.
create policy audit_select on ops.audit_log for select to authenticated
  using ((select ops_private.is_admin()) or workspace_id = any ((select ops_private.my_workspaces())::uuid[]));

-- Outbox: admins can read the delivery log. Delivery state changes only via RPCs.
create policy outbox_select on ops.notification_outbox for select to authenticated
  using ((select ops_private.is_admin()));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Bumps version and updated_at on every update, and keeps completed_at in step with status.
create function ops_private.before_task_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  if new.status = 'done' and old.status <> 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger tasks_before_update before update on ops.tasks
  for each row execute function ops_private.before_task_update();

create function ops_private.before_task_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.completed_at := case when new.status = 'done' then now() end;
  return new;
end $$;

create trigger tasks_before_insert before insert on ops.tasks
  for each row execute function ops_private.before_task_insert();

-- Staff may move their own work along (status, description), but not
-- reassign it, move it to another workspace, or reprioritise it.
create function ops_private.guard_staff_task_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if ops_private.is_admin() or current_setting('ops.seeding', true) = 'on' then
    return new;
  end if;
  if new.assignee_id is distinct from old.assignee_id
     or new.workspace_id is distinct from old.workspace_id
     or new.title is distinct from old.title
     or new.priority is distinct from old.priority
     or new.due_date is distinct from old.due_date
     or new.created_by is distinct from old.created_by then
    raise exception 'staff can only change status and description of their tasks'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger tasks_guard_staff before update on ops.tasks
  for each row execute function ops_private.guard_staff_task_update();

create function ops_private.before_request_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := now();
    if not ops_private.is_admin() and current_setting('ops.seeding', true) is distinct from 'on' and (
         new.assignee_id is distinct from old.assignee_id
         or new.workspace_id is distinct from old.workspace_id
         or new.client_id is distinct from old.client_id) then
      raise exception 'only admins can reassign or move requests' using errcode = '42501';
    end if;
  end if;
  if new.status in ('resolved', 'closed') then
    new.resolved_at := coalesce(new.resolved_at, now());
  else
    new.resolved_at := null;
  end if;
  return new;
end $$;

create trigger requests_before_write before insert or update on ops.client_requests
  for each row execute function ops_private.before_request_write();

create function ops_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger kb_articles_touch before update on ops.kb_articles
  for each row execute function ops_private.touch_updated_at();

-- Generic audit trigger. Records who did what, and for updates only the
-- columns that actually changed ({"col": [old, new]}).
create function ops_private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_ignored text[] := array['updated_at', 'version', 'created_at', 'completed_at', 'resolved_at'];
begin
  if current_setting('ops.seeding', true) = 'on' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key <> all (v_ignored) and (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_array(v_old -> v_key, v_new -> v_key));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;  -- nothing meaningful changed
    end if;
  else
    v_changes := v_row - v_ignored;
  end if;

  insert into ops.audit_log (actor_id, action, entity_type, entity_id, workspace_id, changes)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    case when tg_table_name = 'workspaces' then (v_row ->> 'id')::uuid
         else nullif(v_row ->> 'workspace_id', '')::uuid end,
    v_changes
  );
  return null;
end $$;

create trigger audit_tasks after insert or update or delete on ops.tasks
  for each row execute function ops_private.audit();
create trigger audit_requests after insert or update or delete on ops.client_requests
  for each row execute function ops_private.audit();
create trigger audit_kb after insert or update or delete on ops.kb_articles
  for each row execute function ops_private.audit();
create trigger audit_workspaces after insert or update or delete on ops.workspaces
  for each row execute function ops_private.audit();
create trigger audit_clients after insert or update or delete on ops.clients
  for each row execute function ops_private.audit();
create trigger audit_members after update on ops.members
  for each row execute function ops_private.audit();

-- Enqueue Slack notifications in the same transaction as the change.
create function ops_private.enqueue_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_assignee text;
  v_ws text;
begin
  if current_setting('ops.seeding', true) = 'on' then
    return null;
  end if;
  select name into v_ws from ops.workspaces where id = new.workspace_id;

  if tg_table_name = 'tasks'
     and new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    select full_name into v_assignee from ops.members where id = new.assignee_id;
    insert into ops.notification_outbox (event_type, workspace_id, payload)
    values ('task.assigned', new.workspace_id, jsonb_build_object(
      'text', format('%s was assigned "%s" (%s, %s priority)', v_assignee, new.title, v_ws, new.priority),
      'task_id', new.id));
  elsif tg_table_name = 'client_requests'
     and new.status = 'resolved'
     and (tg_op = 'INSERT' or old.status is distinct from 'resolved') then
    insert into ops.notification_outbox (event_type, workspace_id, payload)
    values ('request.resolved', new.workspace_id, jsonb_build_object(
      'text', format('Client request resolved in %s: "%s"', v_ws, new.title),
      'request_id', new.id));
  end if;
  return null;
end $$;

create trigger notify_tasks after insert or update of assignee_id on ops.tasks
  for each row execute function ops_private.enqueue_notifications();
create trigger notify_requests after insert or update of status on ops.client_requests
  for each row execute function ops_private.enqueue_notifications();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Dashboard counts in one round trip. SECURITY INVOKER: RLS still applies.
create function ops.task_summary(p_today date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'open',          count(*) filter (where t.status <> 'done'),
    'blocked',       count(*) filter (where t.status = 'blocked'),
    'overdue',       count(*) filter (where t.status <> 'done' and t.due_date < p_today),
    'due_this_week', count(*) filter (where t.status <> 'done' and t.due_date between p_today and p_today + 6),
    'mine_open',     count(*) filter (where t.status <> 'done' and t.assignee_id = (select auth.uid()))
  )
  from ops.tasks t
$$;

-- Outbox delivery uses a lease so two workers never send the same message,
-- and a crashed worker's claim expires after 2 minutes.
create function ops.claim_notifications(p_limit integer default 10)
returns table (id bigint, event_type text, payload jsonb, attempts integer, lease_token uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_token uuid := gen_random_uuid();
begin
  if not ops_private.is_member() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  with due as (
    select o.id from ops.notification_outbox o
    where (o.status in ('pending', 'rate_limited') and o.next_attempt_at <= now())
       or (o.status = 'sending' and o.lease_expires_at < now())
    order by o.id
    limit least(greatest(p_limit, 1), 25)
    for update skip locked
  )
  update ops.notification_outbox o
     set status = 'sending', lease_token = v_token, lease_expires_at = now() + interval '2 minutes'
    from due where o.id = due.id
  returning o.id, o.event_type, o.payload, o.attempts, o.lease_token;
end $$;

create function ops.complete_notification(
  p_id bigint, p_lease uuid, p_outcome text, p_http_status integer default null,
  p_error text default null, p_retry_after_seconds integer default null, p_mode text default 'live'
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_attempts integer;
begin
  if not ops_private.is_member() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_outcome not in ('sent', 'rate_limited', 'retry', 'failed', 'release') then
    raise exception 'invalid outcome' using errcode = '22023';
  end if;

  select attempts into v_attempts from ops.notification_outbox
   where id = p_id and lease_token = p_lease and status = 'sending'
   for update;
  if not found then
    raise exception 'lease not held' using errcode = 'P0002';
  end if;

  update ops.notification_outbox set
    attempts         = case when p_outcome = 'release' then attempts else attempts + 1 end,
    status           = case
                         when p_outcome = 'sent' then 'sent'
                         when p_outcome = 'failed' then 'failed'
                         when p_outcome = 'release' then 'pending'
                         when v_attempts + 1 >= 5 then 'failed'   -- give up after 5 attempts
                         when p_outcome = 'rate_limited' then 'rate_limited'
                         else 'pending'
                       end::ops.outbox_status,
    next_attempt_at  = case
                         when p_outcome = 'rate_limited' then now() + make_interval(secs => greatest(coalesce(p_retry_after_seconds, 30), 1))
                         when p_outcome = 'retry' then now() + make_interval(secs => least(30 * power(2, v_attempts)::integer, 3600))
                         else next_attempt_at
                       end,
    last_http_status = p_http_status,
    last_error       = left(p_error, 500),
    delivery_mode    = case when p_mode in ('live', 'mock') then p_mode end,
    sent_at          = case when p_outcome = 'sent' then now() end,
    lease_token      = null,
    lease_expires_at = null
  where id = p_id;
end $$;

-- Admins re-queue a failed notification.
create function ops.retry_notification(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not ops_private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update ops.notification_outbox
     set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null
   where id = p_id and status = 'failed';
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
end $$;


-- Admins queue a test message from the Integrations page.
create function ops.enqueue_test_notification() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
  v_name text;
begin
  if not ops_private.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select full_name into v_name from ops.members where id = auth.uid();
  insert into ops.notification_outbox (event_type, payload)
  values ('integration.test', jsonb_build_object('text', format('Test notification from Ops Hub, sent by %s', v_name)))
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema ops         from public, anon, authenticated;
revoke all on all functions in schema ops         from public, anon, authenticated;
revoke all on all functions in schema ops_private from public, anon, authenticated;
revoke all on schema ops_private from public;

grant usage on schema ops to authenticated;
grant usage on schema ops_private to authenticated;
grant execute on function ops_private.is_admin()      to authenticated;
grant execute on function ops_private.is_member()     to authenticated;
grant execute on function ops_private.my_workspaces() to authenticated;

grant select                                      on ops.members             to authenticated;
grant update (full_name, role, active)            on ops.members             to authenticated;
grant select, insert                              on ops.clients             to authenticated;
grant update (name, contact_email)                on ops.clients             to authenticated;
grant select, insert                              on ops.workspaces          to authenticated;
grant update (name, client_id, archived_at)       on ops.workspaces          to authenticated;
grant select, insert, delete                      on ops.workspace_members   to authenticated;
grant select, delete                              on ops.tasks               to authenticated;
grant insert (workspace_id, title, description, status, priority, assignee_id, due_date) on ops.tasks to authenticated;
grant update (title, description, status, priority, assignee_id, due_date) on ops.tasks to authenticated;
grant select                                      on ops.task_comments       to authenticated;
grant insert (task_id, workspace_id, body)        on ops.task_comments       to authenticated;
grant select, delete                              on ops.client_requests     to authenticated;
grant insert (client_id, workspace_id, title, body, channel, priority, assignee_id) on ops.client_requests to authenticated;
grant update (title, body, status, priority, assignee_id, resolution) on ops.client_requests to authenticated;
grant select                                      on ops.request_notes       to authenticated;
grant insert (request_id, workspace_id, body)     on ops.request_notes       to authenticated;
grant select, insert                              on ops.kb_categories       to authenticated;
grant select, delete                              on ops.kb_articles         to authenticated;
grant insert (category_id, workspace_id, title, slug, body, visibility, published) on ops.kb_articles to authenticated;
grant update (category_id, workspace_id, title, slug, body, visibility, published) on ops.kb_articles to authenticated;
grant select                                      on ops.audit_log           to authenticated;
grant select                                      on ops.notification_outbox to authenticated;

grant execute on function ops.task_summary(date)            to authenticated;
grant execute on function ops.claim_notifications(integer)  to authenticated;
grant execute on function ops.complete_notification(bigint, uuid, text, integer, text, integer, text) to authenticated;
grant execute on function ops.retry_notification(bigint)    to authenticated;
grant execute on function ops.enqueue_test_notification()  to authenticated;
