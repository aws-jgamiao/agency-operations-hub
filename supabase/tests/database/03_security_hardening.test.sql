-- Regression tests for the 2026-11-08 security review findings.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select ops_private.seed_demo_data();

create function pg_temp.act_as(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;

-- 1. Outbox: staff can only claim notifications caused by their own changes.
select pg_temp.act_as('0e000000-0000-4000-8000-0000000000ad');
set local role authenticated;
update ops.tasks set assignee_id = '0e000000-0000-4000-8000-000000000053' where title = 'Go-live checklist';
reset role;
select pg_temp.act_as('0e000000-0000-4000-8000-000000000051');   -- Sam
set local role authenticated;
select is((select count(*)::int from ops.claim_notifications(25)), 0, 'staff cannot claim (or read) notifications caused by others');
reset role;
select pg_temp.act_as('0e000000-0000-4000-8000-0000000000ad');
set local role authenticated;
select is((select count(*)::int from ops.claim_notifications(25)), 1, 'the admin who caused it (and any admin) can');
reset role;

-- 2. Requests: staff can't self-assign on insert, reprioritise, or mismatch client/workspace.
select pg_temp.act_as('0e000000-0000-4000-8000-000000000051');
set local role authenticated;
select lives_ok($$ insert into ops.client_requests (client_id, workspace_id, title, assignee_id)
  values ('0e000000-0000-4000-8000-0000000000c1', '0e000000-0000-4000-8000-0000000000a1', 'Self-assigned?', '0e000000-0000-4000-8000-000000000051') $$,
  'staff can log a request');
reset role;
select is((select assignee_id from ops.client_requests where title = 'Self-assigned?'), null, '... but it is always created unassigned');
select pg_temp.act_as('0e000000-0000-4000-8000-000000000051');
set local role authenticated;
select throws_ok($$ insert into ops.client_requests (client_id, workspace_id, title)
  values ('0e000000-0000-4000-8000-0000000000c2', '0e000000-0000-4000-8000-0000000000a1', 'Wrong client') $$,
  '23514', null, 'a request''s client must match its workspace''s client');
select throws_ok($$ update ops.client_requests set priority = 'urgent' where title = 'Add gluten-free filter to menu' $$,
  '42501', null, 'staff assignees cannot change priority');
reset role;

-- 3. KB audit rows are admin-only.
select pg_temp.act_as('0e000000-0000-4000-8000-0000000000ad');
set local role authenticated;
insert into ops.kb_articles (category_id, workspace_id, title, slug, body, visibility, published)
values ((select id from ops.kb_categories where slug = 'engineering'), '0e000000-0000-4000-8000-0000000000a1',
        'Unpublished northwind plan', 'secret-plan', 'confidential body', 'workspace', false);
reset role;
select pg_temp.act_as('0e000000-0000-4000-8000-000000000051');   -- Sam is in Northwind
set local role authenticated;
select is_empty($$ select 1 from ops.kb_articles where slug = 'secret-plan' $$, 'staff cannot read the unpublished article');
select is_empty($$ select 1 from ops.audit_log where entity_type = 'kb_articles' $$, '... nor its audit rows');
reset role;

-- 4. KB: authors lose access once an admin restricts their article; deactivated authors can't delete.
update ops.kb_articles set visibility = 'admins' where slug = 'deploy-checklist';  -- authored by Sam
select pg_temp.act_as('0e000000-0000-4000-8000-000000000051');
set local role authenticated;
select is_empty($$ select 1 from ops.kb_articles where slug = 'deploy-checklist' $$, 'author cannot read an article an admin restricted');
select results_eq($$ with u as (update ops.kb_articles set visibility = 'all_staff' where slug = 'deploy-checklist' returning 1) select count(*)::int from u $$,
  array[0], '... nor republish it');
reset role;
update ops.members set active = false where id = '0e000000-0000-4000-8000-000000000051';
select pg_temp.act_as('0e000000-0000-4000-8000-000000000051');
set local role authenticated;
select results_eq($$ with d as (delete from ops.kb_articles where slug = 'image-pipeline-draft' returning 1) select count(*)::int from d $$,
  array[0], 'a deactivated author cannot delete their articles');
reset role;

-- 5. The staff guard no longer depends on a settable session flag.
update ops.members set active = true where id = '0e000000-0000-4000-8000-000000000051';
select set_config('ops.seeding', 'on', true);
select pg_temp.act_as('0e000000-0000-4000-8000-000000000051');
set local role authenticated;
select throws_ok($$ update ops.tasks set priority = 'urgent' where title = 'Image optimisation pass' $$,
  '42501', null, 'setting ops.seeding does not bypass the staff guard');
reset role;

select * from finish();
rollback;
