begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Start from the known demo seed (rolled back with the transaction).
select ops_private.seed_demo_data();

\set admin  '''0e000000-0000-4000-8000-0000000000ad'''
\set sam    '''0e000000-0000-4000-8000-000000000051'''
\set lena   '''0e000000-0000-4000-8000-000000000052'''
\set chris  '''0e000000-0000-4000-8000-000000000053'''
\set w_north '''0e000000-0000-4000-8000-0000000000a1'''
\set w_harb  '''0e000000-0000-4000-8000-0000000000a2'''
\set w_int   '''0e000000-0000-4000-8000-0000000000a3'''

create function pg_temp.task_id(p_title text) returns uuid language sql as $$ select id from ops.tasks where title = p_title $$;
create function pg_temp.act_as(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;

-- --------------------------------------------------------------- workspace scoping (Sam: Northwind + Internal)
select pg_temp.act_as(:sam);
set local role authenticated;
select set_eq($$ select id from ops.workspaces $$, array[:w_north::uuid, :w_int::uuid], 'staff only see their own workspaces');
select is_empty(format('select 1 from ops.tasks where workspace_id = %L', :w_harb), 'staff cannot read tasks in other workspaces');
select is_empty(format('select 1 from ops.client_requests where workspace_id = %L', :w_harb), 'staff cannot read requests in other workspaces');
select is_empty(format('select 1 from ops.audit_log where workspace_id = %L', :w_harb), 'staff cannot read audit history of other workspaces');
select throws_ok(format('insert into ops.client_requests (client_id, workspace_id, title) values (%L, %L, %L)',
  '0e000000-0000-4000-8000-0000000000c2', :w_harb, 'Injected'), '42501', null, 'staff cannot log requests into another workspace');
select throws_ok($$ insert into ops.tasks (workspace_id, title) values ('0e000000-0000-4000-8000-0000000000a1', 'New task') $$,
  '42501', null, 'staff cannot create tasks');

-- --------------------------------------------------------------- staff updates
select results_eq($$ with u as (update ops.tasks set status = 'done' where title = 'Build catering enquiry form' returning version) select version from u $$,
  array[2], 'assignee can change status, and the version increments');
select results_eq($$ with u as (update ops.tasks set status = 'done' where title = 'Homepage visual design' returning 1) select count(*)::int from u $$,
  array[0], 'staff cannot update a task assigned to someone else (0 rows)');
select throws_ok($$ update ops.tasks set assignee_id = '0e000000-0000-4000-8000-000000000052' where title = 'Image optimisation pass' $$,
  '42501', 'staff can only change status and description of their tasks', 'staff cannot reassign their own task');
select throws_ok($$ update ops.tasks set priority = 'urgent' where title = 'Image optimisation pass' $$,
  '42501', null, 'staff cannot reprioritise');
select throws_ok($$ update ops.tasks set workspace_id = '0e000000-0000-4000-8000-0000000000a3' where title = 'Image optimisation pass' $$,
  '42501', null, 'staff cannot move a task to another workspace');
select results_eq($$ with d as (delete from ops.tasks where title = 'Image optimisation pass' returning 1) select count(*)::int from d $$,
  array[0], 'staff cannot delete tasks (RLS: 0 rows)');
select throws_ok($$ insert into ops.task_comments (task_id, workspace_id, body, author_id) values (gen_random_uuid(), gen_random_uuid(), 'x', '0e000000-0000-4000-8000-0000000000ad') $$,
  '42501', null, 'comment author cannot be spoofed');
select results_eq($$ with u as (update ops.members set role = 'admin' where id = '0e000000-0000-4000-8000-000000000051' returning 1) select count(*)::int from u $$,
  array[0], 'staff cannot promote themselves (RLS: 0 rows)');

reset role;
select is((select role::text from ops.members where id = :sam), 'staff', 'role is unchanged');
select isnt_empty($$ select 1 from ops.tasks where title = 'Image optimisation pass' $$, 'task still exists');
select is((select completed_at is not null from ops.tasks where title = 'Build catering enquiry form'), true, 'completed_at is set by the trigger');

-- --------------------------------------------------------------- audit log
select is(
  (select changes from ops.audit_log where entity_id = pg_temp.task_id('Build catering enquiry form') order by id desc limit 1),
  '{"status": ["in_progress", "done"]}'::jsonb, 'audit records only the changed column, old and new');
select is(
  (select actor_id from ops.audit_log where entity_id = pg_temp.task_id('Build catering enquiry form') order by id desc limit 1),
  :sam::uuid, 'audit records the responsible user');
select pg_temp.act_as(:admin);
set local role authenticated;
select throws_ok($$ update ops.audit_log set changes = '{}' $$, '42501', null, 'admins cannot alter audit records');
select throws_ok($$ delete from ops.audit_log where id > 0 $$, '42501', null, 'admins cannot delete audit records');
select throws_ok($$ insert into ops.audit_log (action, entity_type, entity_id) values ('insert', 'tasks', gen_random_uuid()) $$, '42501', null, 'audit records cannot be forged');

-- --------------------------------------------------------------- notifications (outbox)
select lives_ok($$ update ops.tasks set assignee_id = '0e000000-0000-4000-8000-000000000051' where title = 'Go-live checklist' $$,
  'admin assigns a task');
reset role;
select is((select count(*)::int from ops.notification_outbox where event_type = 'task.assigned' and status = 'pending'), 1,
  'assignment enqueues exactly one notification in the same transaction');

select pg_temp.act_as(:sam);
set local role authenticated;
select is_empty($$ select 1 from ops.notification_outbox $$, 'staff cannot read the delivery log');
create temp table claimed as select * from ops.claim_notifications(10);
select is((select count(*)::int from claimed), 1, 'a worker claims the due notification');
select is((select count(*)::int from ops.claim_notifications(10)), 0, 'a second claim gets nothing while the lease is held');
select throws_ok($$ select ops.complete_notification((select id from claimed), gen_random_uuid(), 'sent') $$,
  'P0002', null, 'completion requires the lease token');
select lives_ok($$ select ops.complete_notification((select id from claimed), (select lease_token from claimed), 'rate_limited', 429, 'rate limited', 45, 'mock') $$,
  'a rate-limited delivery is recorded');
reset role;
select ok((select status = 'rate_limited' and attempts = 1 and next_attempt_at > now() + interval '40 seconds'
           from ops.notification_outbox where id = (select id from claimed)), 'Retry-After schedules the next attempt');

-- --------------------------------------------------------------- knowledge base
select pg_temp.act_as(:chris);   -- Harbour only
set local role authenticated;
select set_eq($$ select slug from ops.kb_articles $$,
  array['your-first-week', 'deploy-checklist', 'urgent-requests', 'harbour-sms-notes'],
  'staff see published all-staff articles plus their workspace articles; not admin-only or others'' drafts');
select throws_ok($$ insert into ops.kb_articles (category_id, title, slug, visibility) values ((select id from ops.kb_categories limit 1), 'Secret', 'secret', 'admins') $$,
  '42501', null, 'staff cannot publish admin-only articles');
reset role;
select pg_temp.act_as(:sam);   -- not in Harbour
set local role authenticated;
select is_empty($$ select 1 from ops.kb_articles where slug = 'harbour-sms-notes' $$, 'workspace articles are hidden from other workspaces');
select isnt_empty($$ select 1 from ops.kb_articles where slug = 'image-pipeline-draft' $$, 'authors see their own drafts');
reset role;

-- --------------------------------------------------------------- deactivation
update ops.members set active = false where id = :lena;
select pg_temp.act_as(:lena);
set local role authenticated;
select is_empty($$ select 1 from ops.tasks $$, 'a deactivated member immediately loses access to tasks');
select is_empty($$ select 1 from ops.members $$, '... and to the team directory');
reset role;

-- --------------------------------------------------------------- anonymous + grants
set local role anon;
select throws_ok($$ select 1 from ops.tasks $$, '42501', null, 'anonymous users have no access');
reset role;
select is_empty($$ select 1 from information_schema.role_table_grants where grantee in ('anon', 'PUBLIC') and table_schema in ('ops', 'ops_private') $$,
  'anon and PUBLIC hold no table privileges');

-- --------------------------------------------------------------- reset scope
insert into auth.users (id, email, aud, role, raw_app_meta_data) values
  ('0f000000-0000-4000-8000-0000000000f1', 'other-app@example.com', 'authenticated', 'authenticated', '{}');
select pg_temp.act_as(:admin);
set local role authenticated;
select lives_ok($$ select ops.reset_demo() $$, 'demo admin can reset');
reset role;
select isnt_empty($$ select 1 from auth.users where id = '0f000000-0000-4000-8000-0000000000f1' $$, 'reset never touches other apps'' users');
select is((select count(*)::int from ops.tasks), 12, 'reset restores the sample tasks');

select * from finish();
rollback;
