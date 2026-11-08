-- Fix: split the shared notification trigger into one function per table.
--
-- ops_private.enqueue_notifications() served both tasks and client_requests and
-- contained `new.status = 'resolved'`. In a trigger function, NEW has the
-- firing table's row type, so for tasks the literal 'resolved' is resolved
-- against ops.task_status, which has no such value. Any task write that reached
-- that branch failed with 22P02 (unassigned inserts, unassigning, or saving
-- with an unchanged assignee, which the edit form always sends).
-- One function per table keeps every comparison type-correct.

drop trigger notify_tasks on ops.tasks;
drop trigger notify_requests on ops.client_requests;
drop function ops_private.enqueue_notifications();

create function ops_private.enqueue_task_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_assignee text;
  v_ws text;
begin
  if current_setting('ops.seeding', true) = 'on' then
    return null;
  end if;
  if new.assignee_id is null or (tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id) then
    return null;  -- nothing to announce
  end if;
  select name into v_ws from ops.workspaces where id = new.workspace_id;
  select full_name into v_assignee from ops.members where id = new.assignee_id;
  insert into ops.notification_outbox (event_type, workspace_id, payload)
  values ('task.assigned', new.workspace_id, jsonb_build_object(
    'text', format('%s was assigned "%s" (%s, %s priority)', v_assignee, new.title, v_ws, new.priority),
    'task_id', new.id));
  return null;
end $$;

create function ops_private.enqueue_request_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ws text;
begin
  if current_setting('ops.seeding', true) = 'on' then
    return null;
  end if;
  if new.status <> 'resolved' or (tg_op = 'UPDATE' and old.status = 'resolved') then
    return null;
  end if;
  select name into v_ws from ops.workspaces where id = new.workspace_id;
  insert into ops.notification_outbox (event_type, workspace_id, payload)
  values ('request.resolved', new.workspace_id, jsonb_build_object(
    'text', format('Client request resolved in %s: "%s"', v_ws, new.title),
    'request_id', new.id));
  return null;
end $$;

create trigger notify_tasks after insert or update of assignee_id on ops.tasks
  for each row execute function ops_private.enqueue_task_notification();
create trigger notify_requests after insert or update of status on ops.client_requests
  for each row execute function ops_private.enqueue_request_notification();

revoke all on function ops_private.enqueue_task_notification() from public, anon, authenticated;
revoke all on function ops_private.enqueue_request_notification() from public, anon, authenticated;
