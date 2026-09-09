-- Leave + SG public holidays + hr read access (spec:
-- docs/superpowers/specs/2026-09-04-hr-leave-design.md, Nic 2026-09-04).
-- Companion to 0057_hr_role_enum.sql. Additive on the shared live DB:
-- deployed dev/main code never reads these tables, and the replaced SELECT
-- policies only widen. Safe to apply before the code deploys (required, in
-- fact — an UPDATE/SELECT against a missing column is a 42703 crash).
--
-- Numbers claimed 2026-09-08 against the live DB and every branch — see the
-- header of 0057. (0051 is burned by the cancelled feat-workflow-v3, which
-- never merged but stays applied; same-number files are silently skipped by
-- db push, the 0015->0031 lesson.)
--
-- ═══════════════════════════════════════════════════════════════════════
-- SPLITTING 'hr' INTO SEPARATE hr + finance ROLES LATER (Nic, 2026-09-08)
-- ═══════════════════════════════════════════════════════════════════════
-- The role is HR *and* Finance today because one person does both jobs.
-- Every policy below therefore asks a named CAPABILITY question rather than
-- naming the role, so the split is one small migration redefining three
-- functions instead of a hunt through a dozen policies:
--
--   can_manage_leave()       — the HR half   (leave + holiday records)
--   can_view_all_prices()    — the Finance half (job_financials SELECT)
--   can_view_jobs_readonly() — shared by both halves (read-only job access)
--
-- To split: `alter type user_role add value 'finance'` in its own migration,
-- then redefine can_view_all_prices() and can_view_jobs_readonly() to include
-- 'finance' and leave can_manage_leave() alone. No policy is rewritten, no
-- row is migrated, and the existing hr account keeps working untouched.
-- The TypeScript mirror of these three questions lives in
-- src/lib/auth/capabilities.ts — keep the two in step.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 0. Capability helpers ───────────────────────────────────────────────
-- Same shape as get_my_role() (0002_rls.sql:22-27), which they delegate to.
-- They do not need `security definer` themselves: get_my_role() already is,
-- and it is the only thing here that touches an RLS-protected table.

create or replace function can_manage_leave()
returns boolean
language sql stable
as $$
  select get_my_role() in ('hr', 'admin');
$$;

comment on function can_manage_leave() is
  'HR half of the hr/finance role: may write leave + public holiday records. Add a future finance role here only if it should also record leave.';

create or replace function can_view_all_prices()
returns boolean
language sql stable
as $$
  select get_my_role() in ('sales', 'scheduler', 'admin', 'hr');
$$;

comment on function can_view_all_prices() is
  'Finance half of the hr/finance role: may READ job_financials. Writing prices stays with sales/scheduler/admin. Add a future finance role here.';

create or replace function can_view_jobs_readonly()
returns boolean
language sql stable
as $$
  select get_my_role() = 'hr';
$$;

comment on function can_view_jobs_readonly() is
  'Shared by both halves of the hr/finance role: read-only view of non-pending jobs, no INSERT/UPDATE anywhere. Add a future finance role here.';

-- ── 1. Leave records — who + when. Readable by every logged-in user
--       (schedule display + clash checks); written by hr + admin only. ──────
create table public.user_leaves (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  date_start    date not null,
  date_end      date not null,
  start_portion text not null default 'full' check (start_portion in ('full', 'am', 'pm')),
  end_portion   text not null default 'full' check (end_portion in ('full', 'am', 'pm')),
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (date_end >= date_start)
);

create index user_leaves_user_idx  on public.user_leaves (user_id, date_start);
create index user_leaves_range_idx on public.user_leaves (date_start, date_end);

alter table public.user_leaves enable row level security;

create policy "leaves: authenticated select"
  on public.user_leaves for select to authenticated
  using (true);

create policy "leaves: manage insert"
  on public.user_leaves for insert to authenticated
  with check (can_manage_leave());

create policy "leaves: manage update"
  on public.user_leaves for update to authenticated
  using (can_manage_leave())
  with check (can_manage_leave());

create policy "leaves: manage delete"
  on public.user_leaves for delete to authenticated
  using (can_manage_leave());

-- ── 2. Leave details — type + note. HR + admin ONLY, enforced here at the
--       DB layer (spec decision 7): no other role can ever read the reason. ──
create table public.user_leave_details (
  leave_id   uuid primary key references public.user_leaves(id) on delete cascade,
  leave_type text not null default 'other' check (leave_type in ('annual', 'medical', 'emergency', 'other')),
  note       text
);

alter table public.user_leave_details enable row level security;

create policy "leave_details: manage all"
  on public.user_leave_details for all to authenticated
  using (can_manage_leave())
  with check (can_manage_leave());

-- ── 3. Singapore public holidays — label-only calendar, maintained yearly
--       by HR (about 11 rows/year). No external service (stack locked). ─────
create table public.public_holidays (
  id           uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name         text not null,
  unique (holiday_date, name)
);

alter table public.public_holidays enable row level security;

create policy "holidays: authenticated select"
  on public.public_holidays for select to authenticated
  using (true);

create policy "holidays: manage insert"
  on public.public_holidays for insert to authenticated
  with check (can_manage_leave());

create policy "holidays: manage update"
  on public.public_holidays for update to authenticated
  using (can_manage_leave())
  with check (can_manage_leave());

create policy "holidays: manage delete"
  on public.public_holidays for delete to authenticated
  using (can_manage_leave());

-- Gazetted 2026 list (MOM). Nic verifies these on the preview against
-- https://www.mom.gov.sg/employment-practices/public-holidays — HR edits any
-- discrepancy from the Leave tab. 2027 gets added by HR when gazetted.
insert into public.public_holidays (holiday_date, name) values
  ('2026-01-01', 'New Year''s Day'),
  ('2026-02-17', 'Chinese New Year'),
  ('2026-02-18', 'Chinese New Year'),
  ('2026-03-21', 'Hari Raya Puasa'),
  ('2026-04-03', 'Good Friday'),
  ('2026-05-01', 'Labour Day'),
  ('2026-05-27', 'Hari Raya Haji'),
  ('2026-05-31', 'Vesak Day'),
  ('2026-08-09', 'National Day'),
  ('2026-11-08', 'Deepavali'),
  ('2026-12-25', 'Christmas Day')
on conflict (holiday_date, name) do nothing;

-- ── 4. hr read access: jobs (non-pending ONLY), prices, files ───────────────
-- Additive policy — RLS policies OR together, existing ones untouched.
create policy "jobs: readonly role non-pending select"
  on jobs for select to authenticated
  using (can_view_jobs_readonly() and status not in ('pending', 'awaiting_approval'));

-- Prices: the finance capability joins the read list (SELECT only — insert
-- and update stay sales/scheduler/admin; she views, sales keeps entering).
DROP POLICY IF EXISTS "financials: sales and scheduler select" ON job_financials;
CREATE POLICY "financials: sales and scheduler select"
  ON job_financials FOR SELECT TO authenticated
  USING (can_view_all_prices());

-- Files: hr reads job files (read-only Files card on the job form).
-- Role list = the live 0050 definition + 'hr' (verified against
-- 0050_addendum_access.sql:75 — never drop a role 0050 granted). Left as a
-- plain list on purpose: 0050 documents it as a superset of six roles, and a
-- future finance role is one more word here.
DROP POLICY IF EXISTS "files: select by role" ON files;
CREATE POLICY "files: select by role"
  ON files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.role::text IN ('sales', 'scheduler', 'admin', 'designer', 'coordinator', 'production', 'hr')
    )
  );

-- ── 5. Realtime — schedule pages update live when HR records leave ──────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'user_leaves'
  ) then
    alter publication supabase_realtime add table user_leaves;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'public_holidays'
  ) then
    alter publication supabase_realtime add table public_holidays;
  end if;
end $$;

alter table public.user_leaves     replica identity full;
alter table public.public_holidays replica identity full;
