-- =============================================================================
-- Security hardening from the internal review (2026-11-08). See docs/SECURITY.md.
-- =============================================================================

-- 1. Outbox: staff could claim (and read, or suppress) every queued notification.
--    Each row now records who caused it; non-admins can only claim their own.
alter table ops.notification_outbox add column created_by uuid default auth.uid();

create or replace function ops.claim_notifications(p_limit integer default 10)
returns table (id bigint, event_type text, payload jsonb, attempts integer, lease_token uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_token uuid := gen_random_uuid();
  v_admin boolean := ops_private.is_admin();
begin
  if not ops_private.is_member() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
  with due as (
    select o.id from ops.notification_outbox o
    where ((o.status in ('pending', 'rate_limited') and o.next_attempt_at <= now())
        or (o.status = 'sending' and o.lease_expires_at < now()))
      and (v_admin or o.created_by = auth.uid())
    order by o.id
    limit least(greatest(p_limit, 1), 25)
    for update skip locked
  )
  update ops.notification_outbox o
     set status = 'sending', lease_token = v_token, lease_expires_at = now() + interval '2 minutes'
    from due where o.id = due.id
  returning o.id, o.event_type, o.payload, o.attempts, o.lease_token;
end $$;

-- 2. Guards apply to every API (authenticated) session. The previous
--    `ops.seeding` session-setting escape hatch is no longer used by the
--    guards: seeding runs as the function owner, not as `authenticated`.
create or replace function ops_private.guard_staff_task_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' or ops_private.is_admin() then
    return new;
  end if;
  if new.assignee_id is distinct from old.assignee_id
     or new.workspace_id is distinct from old.workspace_id
     or new.title is distinct from old.title
     or new.priority is distinct from old.priority
     or new.due_date is distinct from old.due_date
     or new.created_by is distinct from old.created_by then
    raise exception 'staff can only change status and description of their tasks' using errcode = '42501';
  end if;
  return new;
end $$;

-- 3. Requests: staff-logged requests always start unassigned (previously only
--    the UI did this), staff can't change priority, and the client must match
--    the workspace's client.
create or replace function ops_private.before_request_write() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_api_staff boolean := current_user = 'authenticated' and not ops_private.is_admin();
  v_ws_client uuid;
begin
  select client_id into v_ws_client from ops.workspaces where id = new.workspace_id;
  if v_ws_client is not null and v_ws_client <> new.client_id then
    raise exception 'client does not belong to this workspace' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and v_api_staff then
    new.assignee_id := null;
  end if;

  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := now();
    if v_api_staff and (
         new.assignee_id is distinct from old.assignee_id
         or new.workspace_id is distinct from old.workspace_id
         or new.client_id is distinct from old.client_id
         or new.priority is distinct from old.priority) then
      raise exception 'only admins can reassign, move or reprioritise requests' using errcode = '42501';
    end if;
  end if;

  if new.status in ('resolved', 'closed') then
    new.resolved_at := coalesce(new.resolved_at, now());
  else
    new.resolved_at := null;
  end if;
  return new;
end $$;

-- 4. Audit rows for KB articles are admin-only (workspace_id = null), so the
--    audit trail can't reveal unpublished workspace articles to staff.
create or replace function ops_private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_ignored text[] := array['updated_at', 'version', 'created_at', 'completed_at', 'resolved_at'];
begin
  -- Skipped only while seed_demo_data() runs. API clients cannot set this
  -- setting (PostgREST doesn't expose arbitrary GUCs); see docs/SECURITY.md.
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
      return null;
    end if;
  else
    v_changes := v_row - v_ignored;
  end if;

  insert into ops.audit_log (actor_id, action, entity_type, entity_id, workspace_id, changes)
  values (
    auth.uid(), lower(tg_op), tg_table_name, (v_row ->> 'id')::uuid,
    case
      when tg_table_name = 'kb_articles' then null
      when tg_table_name = 'workspaces' then (v_row ->> 'id')::uuid
      else nullif(v_row ->> 'workspace_id', '')::uuid
    end,
    v_changes);
  return null;
end $$;

update ops.audit_log set workspace_id = null where entity_type = 'kb_articles';

-- 5. KB: deactivated members can't delete; authors lose access to articles an
--    admin has restricted to admins.
drop policy kb_articles_select on ops.kb_articles;
create policy kb_articles_select on ops.kb_articles for select to authenticated
  using (
    (select ops_private.is_admin())
    or ((select ops_private.is_member()) and author_id = (select auth.uid()) and visibility <> 'admins')
    or ((select ops_private.is_member()) and published and (
          visibility = 'all_staff'
          or (visibility = 'workspace' and workspace_id = any ((select ops_private.my_workspaces())::uuid[]))))
  );

drop policy kb_articles_update on ops.kb_articles;
create policy kb_articles_update on ops.kb_articles for update to authenticated
  using ((select ops_private.is_admin())
         or (author_id = (select auth.uid()) and visibility <> 'admins' and (select ops_private.is_member())))
  with check (
    (select ops_private.is_admin())
    or (author_id = (select auth.uid()) and visibility <> 'admins'
        and (visibility <> 'workspace' or workspace_id = any ((select ops_private.my_workspaces())::uuid[])))
  );

drop policy kb_articles_delete on ops.kb_articles;
create policy kb_articles_delete on ops.kb_articles for delete to authenticated
  using ((select ops_private.is_admin())
         or (author_id = (select auth.uid()) and visibility <> 'admins' and (select ops_private.is_member())));
