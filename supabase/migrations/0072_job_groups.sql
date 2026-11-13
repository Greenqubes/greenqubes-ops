-- 0072_job_groups.sql
-- Job groups on the Jobs tab (Nic, 2026-11-11; spec
-- 2026-11-11-gallery-groups-bulk-sheet-design.md Part 4; plan
-- 2026-11-12-job-groups.md Task 2). Near-identical jobs — one campaign, many
-- stores — fold into one shared, named row that everyone sees the same way.
--
-- Number claimed 2026-11-12: live DB (migration list) at 0071; every branch
-- (dev, origin/dev, origin/main, feat-job-groups) tops out at 0071 or below.
--
-- NOT Workflow V3: do not reuse job_projects / jobs.project_id (0051) — that
-- table carries the cancelled "project containers" meaning (client, timings,
-- punctuality, file ownership). 0051 stays applied and untouched. A group here
-- is a name and nothing else: no shared details, files, timings or schedule.
--
-- Writes go only through POST /api/job-groups (role + visibility checks on
-- the caller's session, then the service key), so there are no write
-- policies. Grouping touches jobs.group_id and nothing else on a job.

create table public.job_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger job_groups_touch_updated_at
  before update on public.job_groups
  for each row execute function touch_updated_at();

-- One job, one group. Ungroup = delete the group; the jobs simply unfold.
alter table public.jobs
  add column group_id uuid references public.job_groups(id) on delete set null;

create index jobs_group_id_idx on public.jobs (group_id) where group_id is not null;

alter table public.job_groups enable row level security;

-- A group is readable only while it holds a job the caller can see. The
-- subquery runs under the caller's own jobs policies, so a group made only of
-- someone else's private drafts (0062) reveals not even its name.
create policy "job groups: read when a job in it is visible"
  on public.job_groups for select to authenticated
  using (exists (select 1 from public.jobs j where j.group_id = job_groups.id));

grant select, insert, update, delete on public.job_groups to authenticated;
grant select, insert, update, delete on public.job_groups to service_role;
