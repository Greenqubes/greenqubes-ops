-- =============================================================
-- Greenqubes ops platform — demo seed data
-- Run AFTER all three migration files are applied.
-- Uses fixed UUIDs so re-running is idempotent (ON CONFLICT DO NOTHING).
--
-- Demo team: Sarah (sales), Kai (scheduler), Ravi + Ali (installers)
-- Demo jobs: 4 jobs across all four statuses
-- =============================================================

-- Auth users (magic-link only — no passwords needed)
-- These can also be created via Dashboard → Authentication → Users
insert into auth.users (
  id, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  aud, role, created_at, updated_at
) values
  (
    'a0000000-0000-0000-0000-000000000001',
    'sarah@greenqubes.com', now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', now(), now()
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'kai@greenqubes.com', now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', now(), now()
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'ravi@greenqubes.com', now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', now(), now()
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'ali@greenqubes.com', now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', now(), now()
  )
on conflict (id) do nothing;

-- Public users
insert into users (id, auth_id, name, role, lang, phone) values
  (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Sarah Lim', 'sales', 'en', '+6591000001'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'Kai Tan', 'scheduler', 'zh', '+6591000002'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'Ravi Kumar', 'installer', 'en', '+6591000003'
  ),
  (
    'b0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000004',
    'Ali Hassan', 'installer', 'bn', '+6591000004'
  )
on conflict (id) do nothing;

-- Jobs
insert into jobs (
  id, status, date, time_start, time_end,
  client, location, description,
  client_poc_name, client_poc_phone,
  sales_poc_id, production_ready, do_issued, punctuality,
  approved_by, approved_at,
  visibility
) values
  (
    -- scheduled: tomorrow, both installers assigned
    'c0000000-0000-0000-0000-000000000001',
    'scheduled',
    current_date + 1,
    '09:00', '13:00',
    'Tan Residence',
    '42 Bukit Timah Road, Singapore 229788',
    'Install 3x split-unit aircon, run trunking to false ceiling',
    'Mr Tan Wei Ming', '+6598765001',
    'b0000000-0000-0000-0000-000000000001',
    true, true, 'strict',
    'b0000000-0000-0000-0000-000000000002',
    now() - interval '2 days',
    array['public-internal']
  ),
  (
    -- awaiting_approval: submitted by sales, scheduler hasn't approved yet
    'c0000000-0000-0000-0000-000000000002',
    'awaiting_approval',
    current_date + 3,
    '14:00', '18:00',
    'Greentech Office',
    '18 Cross Street, Singapore 048423',
    'Service + gas top-up for 6 existing fancoil units on levels 3 and 4',
    'Ms Priya Nair', '+6565430000',
    'b0000000-0000-0000-0000-000000000001',
    false, false, 'flexible',
    null, null,
    array['public-internal']
  ),
  (
    -- completed: 3 days ago, both installers
    'c0000000-0000-0000-0000-000000000003',
    'completed',
    current_date - 3,
    '10:00', '15:00',
    'Wong Family Home',
    '7 Jalan Bukit Ho Swee, Singapore 162007',
    'Full system install — 4 units + ceiling cassette FCU',
    'Mrs Wong Bee Leng', '+6591230004',
    'b0000000-0000-0000-0000-000000000001',
    true, true, 'strict',
    'b0000000-0000-0000-0000-000000000002',
    now() - interval '7 days',
    array['public-internal']
  ),
  (
    -- pending: drafted by sales, not yet submitted
    'c0000000-0000-0000-0000-000000000004',
    'pending',
    current_date + 7,
    '09:00', '12:00',
    'Raffles Hotel (new annex)',
    '1 Beach Road, Singapore 189673',
    'Pre-install site survey and quote finalisation for lobby FCU replacement',
    'Mr David Lim (facilities)', '+6563378888',
    'b0000000-0000-0000-0000-000000000001',
    false, false, 'strict',
    null, null,
    array['public-internal']
  )
on conflict (id) do nothing;

-- Job financials (sales + scheduler eyes only)
insert into job_financials (job_id, quote_amount, supplier_cost, margin_notes) values
  (
    'c0000000-0000-0000-0000-000000000001',
    2800.00, 1650.00,
    'Daikin FTKF series x3 from Supplier A. Markup 70%.'
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    480.00, 120.00,
    'R32 gas top-up + 3hr labour. Low margin, relationship job.'
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    5200.00, 3100.00,
    'Mitsubishi Starmex full system x4. Final invoice sent.'
  ),
  (
    'c0000000-0000-0000-0000-000000000004',
    null, null,
    'Pending site survey — quote TBD'
  )
on conflict (job_id) do nothing;

-- Job assignees
insert into job_assignees (job_id, user_id) values
  -- Tan Residence: Ravi + Ali
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004'),
  -- Greentech Office: Ravi only
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003'),
  -- Wong Family Home: Ravi + Ali
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004')
  -- Raffles Hotel: no assignees yet (still pending)
on conflict do nothing;

-- Sample chat messages on the completed job
insert into messages (id, job_id, author_id, kind, content, ts) values
  (
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000003',
    'text',
    'On site. Pipe routing confirmed, starting install.',
    now() - interval '3 days' - interval '5 hours'
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000001',
    'text',
    'Great, let me know if you need anything. Client is home.',
    now() - interval '3 days' - interval '4 hours 50 minutes'
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000003',
    'text',
    'All units installed and tested. Uploading completion photos now.',
    now() - interval '3 days' - interval '1 hour'
  )
on conflict (id) do nothing;
