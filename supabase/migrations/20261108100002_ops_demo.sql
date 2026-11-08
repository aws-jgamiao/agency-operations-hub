-- =============================================================================
-- Demo data + reset for Agency Operations Hub.
-- Auth users are created by scripts/sql/create-demo-users.sql.
-- Only auth.users rows tagged app = 'agency-operations-hub' are ever touched.
-- Every mass DELETE has an explicit WHERE: PostgREST sessions load
-- pg-safeupdate (a lesson from client-portal-mini).
-- =============================================================================

create function ops_private.seed_demo_data() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := '0e000000-0000-4000-8000-0000000000ad';
  v_sam   uuid := '0e000000-0000-4000-8000-000000000051';
  v_lena  uuid := '0e000000-0000-4000-8000-000000000052';
  v_chris uuid := '0e000000-0000-4000-8000-000000000053';
  v_users uuid[] := array[v_admin, v_sam, v_lena, v_chris];
  c_north uuid := '0e000000-0000-4000-8000-0000000000c1';
  c_harb  uuid := '0e000000-0000-4000-8000-0000000000c2';
  w_north uuid := '0e000000-0000-4000-8000-0000000000a1';
  w_harb  uuid := '0e000000-0000-4000-8000-0000000000a2';
  w_int   uuid := '0e000000-0000-4000-8000-0000000000a3';
  k_onb   uuid := '0e000000-0000-4000-8000-0000000000b1';
  k_eng   uuid := '0e000000-0000-4000-8000-0000000000b2';
  k_care  uuid := '0e000000-0000-4000-8000-0000000000b3';
  d date := current_date;
begin
  perform set_config('ops.seeding', 'on', true);

  delete from ops.audit_log where id is not null;
  delete from ops.notification_outbox where id is not null;
  delete from ops.kb_articles where id is not null;
  delete from ops.kb_categories where id is not null;
  delete from ops.workspaces where id is not null;     -- cascades tasks, requests, notes, comments
  delete from ops.clients where id is not null;
  delete from ops.members where id <> all (v_users);

  delete from auth.users where raw_app_meta_data->>'app' = 'agency-operations-hub' and id <> all (v_users);
  update auth.users set encrypted_password = extensions.crypt('DemoOps!2026', extensions.gen_salt('bf'))
   where raw_app_meta_data->>'app' = 'agency-operations-hub' and id = any (v_users);

  insert into ops.members (id, email, full_name, role, active, is_demo)
  select u.id, u.email, x.full_name, x.role::ops.member_role, true, true
  from (values
    (v_admin, 'Morgan Reyes', 'admin'),
    (v_sam,   'Sam Patel',    'staff'),
    (v_lena,  'Lena Fischer', 'staff'),
    (v_chris, 'Chris Okafor', 'staff')
  ) as x(id, full_name, role)
  join auth.users u on u.id = x.id
  on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, active = true, is_demo = true;

  insert into ops.clients (id, name, contact_email) values
    (c_north, 'Northwind Bakery', 'priya@northwind.example.com'),
    (c_harb,  'Harbour Physio',   'marcus@harbourphysio.example.com');

  insert into ops.workspaces (id, name, client_id) values
    (w_north, 'Northwind website', c_north),
    (w_harb,  'Harbour bookings',  c_harb),
    (w_int,   'Internal operations', null);

  insert into ops.workspace_members (workspace_id, member_id) values
    (w_north, v_sam), (w_north, v_lena),
    (w_harb, v_lena), (w_harb, v_chris),
    (w_int, v_sam);

  insert into ops.tasks (workspace_id, title, description, status, priority, assignee_id, due_date, created_by, created_at) values
    (w_north, 'Build catering enquiry form', 'Form posts to orders@ and the owner. Needs spam protection and a confirmation email.', 'in_progress', 'high', v_sam, d + 2, v_admin, now() - interval '9 days'),
    (w_north, 'Menu page CMS model', 'Editable sections for breads, pastries and cakes with seasonal flags.', 'done', 'medium', v_sam, d - 4, v_admin, now() - interval '14 days'),
    (w_north, 'Homepage visual design', 'Two hero options for sign-off on Thursday.', 'in_progress', 'high', v_lena, d + 1, v_admin, now() - interval '8 days'),
    (w_north, 'Image optimisation pass', 'Convert gallery to AVIF/WebP with responsive sizes.', 'todo', 'low', v_sam, d + 12, v_admin, now() - interval '3 days'),
    (w_north, 'Fix broken Google Maps embed', 'Second store map shows the wrong pin.', 'blocked', 'medium', v_sam, d - 2, v_admin, now() - interval '6 days'),
    (w_north, 'Accessibility review of templates', 'Keyboard and screen-reader pass on all page templates.', 'todo', 'medium', v_lena, d + 9, v_admin, now() - interval '2 days'),
    (w_harb,  'Import historic bookings CSV', 'Map practitioner names to new IDs; flag duplicates.', 'done', 'urgent', v_chris, d - 6, v_admin, now() - interval '16 days'),
    (w_harb,  'SMS reminder templates', '48h and 2h reminders; include reschedule link.', 'in_progress', 'high', v_chris, d - 1, v_admin, now() - interval '7 days'),
    (w_harb,  'Booking widget styling', 'Match clinic brand colours; check contrast.', 'todo', 'medium', v_lena, d + 4, v_admin, now() - interval '4 days'),
    (w_harb,  'Go-live checklist', 'Final checks before switching DNS for the booking site.', 'todo', 'urgent', null, d + 5, v_admin, now() - interval '1 day'),
    (w_int,   'Rotate shared credentials', 'Quarterly rotation of vault entries used by the team.', 'todo', 'high', v_sam, d - 3, v_admin, now() - interval '10 days'),
    (w_int,   'Update onboarding checklist', 'Add the new VPN steps to the staff onboarding doc.', 'todo', 'low', null, d + 20, v_admin, now() - interval '5 days');

  insert into ops.client_requests (client_id, workspace_id, title, body, channel, status, priority, assignee_id, resolution, created_by, created_at) values
    (c_north, w_north, 'Add gluten-free filter to menu', 'Customers keep asking which items are gluten-free. Can we add a filter?', 'email', 'triaged', 'medium', v_sam, null, v_admin, now() - interval '3 days'),
    (c_north, w_north, 'Catering form sends to wrong inbox', 'Test enquiry from Friday went to the old address.', 'phone', 'in_progress', 'high', v_sam, null, v_admin, now() - interval '1 day'),
    (c_north, w_north, 'Change Saturday opening hours', 'Saturdays now open 7am.', 'portal', 'resolved', 'low', v_lena, 'Updated hours on the locations page and Google profile.', v_admin, now() - interval '6 days'),
    (c_harb,  w_harb,  'Practitioner photo update', 'New headshot for Dr. Nguyen attached to email.', 'email', 'new', 'low', null, null, v_admin, now() - interval '5 hours'),
    (c_harb,  w_harb,  'Reminder SMS shows wrong clinic name', 'Patients got "Harbor" instead of "Harbour".', 'phone', 'waiting_on_client', 'urgent', v_chris, null, v_admin, now() - interval '2 days');

  insert into ops.request_notes (request_id, workspace_id, author_id, body, created_at)
  select r.id, r.workspace_id, v_chris, 'Sender ID registration uses the carrier spelling; asked Marcus to confirm the registered business name.', now() - interval '1 day'
  from ops.client_requests r where r.title = 'Reminder SMS shows wrong clinic name';

  insert into ops.task_comments (task_id, workspace_id, author_id, body, created_at)
  select t.id, t.workspace_id, v_sam, 'Blocked on the client confirming which address the second store uses on Google.', now() - interval '2 days'
  from ops.tasks t where t.title = 'Fix broken Google Maps embed';

  insert into ops.kb_categories (id, name, slug) values
    (k_onb, 'Onboarding', 'onboarding'), (k_eng, 'Engineering', 'engineering'), (k_care, 'Client care', 'client-care');

  insert into ops.kb_articles (category_id, workspace_id, title, slug, body, visibility, published, author_id) values
    (k_onb, null, 'Your first week', 'your-first-week',
     E'Welcome to the team!\n\n1. Get access to the shared vault from Morgan.\n2. Join your workspaces in the Ops Hub.\n3. Shadow a client call before running one.\n4. Read "How we estimate".', 'all_staff', true, v_admin),
    (k_eng, null, 'Deploy checklist', 'deploy-checklist',
     E'Before any production deploy:\n\n- CI is green (lint, types, tests).\n- Migrations reviewed by a second person.\n- Rollback plan written in the PR.\n- Client told about any visible change.', 'all_staff', true, v_sam),
    (k_care, null, 'Handling urgent client requests', 'urgent-requests',
     E'Urgent = the client is losing money or customers right now.\n\nAcknowledge within 30 minutes, assign an owner, and post an update every 2 hours until resolved.', 'all_staff', true, v_admin),
    (k_care, w_harb, 'Harbour Physio: SMS provider notes', 'harbour-sms-notes',
     E'Sender ID is registered as "HarbourPhy".\nCarrier approval takes 3 to 5 business days for changes.', 'workspace', true, v_chris),
    (k_onb, null, 'Rate card and margins', 'rate-card',
     E'Internal only: current hourly rates and target margins per service line.', 'admins', true, v_admin),
    (k_eng, null, 'Draft: image pipeline', 'image-pipeline-draft',
     E'Work in progress: notes on the AVIF/WebP pipeline.', 'all_staff', false, v_sam);

  -- A little history so the audit log and dashboard aren't empty.
  insert into ops.audit_log (occurred_at, actor_id, action, entity_type, entity_id, workspace_id, changes)
  select now() - interval '4 days', v_sam, 'update', 'tasks', t.id, t.workspace_id, '{"status": ["in_progress", "done"]}'::jsonb
  from ops.tasks t where t.title = 'Menu page CMS model';
  insert into ops.audit_log (occurred_at, actor_id, action, entity_type, entity_id, workspace_id, changes)
  select now() - interval '2 days', v_sam, 'update', 'tasks', t.id, t.workspace_id, '{"status": ["in_progress", "blocked"]}'::jsonb
  from ops.tasks t where t.title = 'Fix broken Google Maps embed';
  insert into ops.audit_log (occurred_at, actor_id, action, entity_type, entity_id, workspace_id, changes)
  select now() - interval '6 days', v_lena, 'update', 'client_requests', r.id, r.workspace_id, '{"status": ["in_progress", "resolved"]}'::jsonb
  from ops.client_requests r where r.title = 'Change Saturday opening hours';

  insert into ops.notification_outbox (event_type, workspace_id, payload, status, attempts, delivery_mode, created_at, sent_at, next_attempt_at)
  values ('request.resolved', w_north, '{"text": "Client request resolved in Northwind website: \"Change Saturday opening hours\""}'::jsonb,
          'sent', 1, 'mock', now() - interval '6 days', now() - interval '6 days', now() - interval '6 days');

  perform set_config('ops.seeding', 'off', true);
end $$;

create function ops.reset_demo() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from ops.members where id = auth.uid() and role = 'admin' and is_demo and active) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  perform ops_private.seed_demo_data();
end $$;

revoke all on function ops_private.seed_demo_data() from public, anon, authenticated;
revoke all on function ops.reset_demo() from public, anon;
grant execute on function ops.reset_demo() to authenticated;
