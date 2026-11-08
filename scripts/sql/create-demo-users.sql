-- Creates the Agency Operations Hub demo accounts and sample data.
-- Shared-project safe: four fixed ids on example.com, ON CONFLICT DO NOTHING,
-- tagged raw_app_meta_data.app = 'agency-operations-hub'.
-- Password for every demo account: DemoOps!2026 (published on the landing page).
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('0e000000-0000-4000-8000-0000000000ad'::uuid, 'ops-admin@example.com'),
      ('0e000000-0000-4000-8000-000000000051'::uuid, 'ops-sam@example.com'),
      ('0e000000-0000-4000-8000-000000000052'::uuid, 'ops-lena@example.com'),
      ('0e000000-0000-4000-8000-000000000053'::uuid, 'ops-chris@example.com')
    ) as t(id, email)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('DemoOps!2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"],"app":"agency-operations-hub"}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    ) on conflict do nothing;
  end loop;
end $$;

select ops_private.seed_demo_data();
