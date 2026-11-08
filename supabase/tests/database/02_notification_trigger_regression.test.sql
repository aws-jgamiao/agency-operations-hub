-- Regression: a shared trigger function compared NEW.status with 'resolved',
-- which is not a valid ops.task_status. Postgres resolves the literal against
-- the firing table's enum, so task writes that reached that branch failed with
-- 22P02 "invalid input value for enum ops.task_status".
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Start from the known demo seed (rolled back with the transaction).
select ops_private.seed_demo_data();

select set_config('request.jwt.claims', '{"sub":"0e000000-0000-4000-8000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$ insert into ops.tasks (workspace_id, title) values ('0e000000-0000-4000-8000-0000000000a1', 'Unassigned task') $$,
  'admin can create an unassigned task');
select lives_ok($$ update ops.tasks set assignee_id = assignee_id, status = 'blocked' where title = 'Build catering enquiry form' $$,
  'saving a task with an unchanged assignee works (the edit form always sends assignee_id)');
select lives_ok($$ update ops.tasks set assignee_id = null where title = 'Build catering enquiry form' $$,
  'admin can unassign a task');
select lives_ok($$ update ops.client_requests set status = 'resolved', resolution = 'Done' where title = 'Add gluten-free filter to menu' $$,
  'resolving a request still works');

reset role;
select is((select count(*)::int from ops.notification_outbox where event_type = 'task.assigned' and status = 'pending'), 0,
  'no assignment notifications for unassigned or unchanged assignees');
select is((select count(*)::int from ops.notification_outbox where event_type = 'request.resolved' and status = 'pending'), 1,
  'resolving a request still enqueues one notification');

select * from finish();
rollback;
