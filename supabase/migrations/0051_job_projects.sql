-- 0051_job_projects.sql
-- Workflow V3 round 1 (spec: docs/superpowers/specs/2026-09-02-workflow-v3-nesting-design.md §2).
-- A project is a container with labels. Jobs point at it; deleting a project
-- can never delete a job (SET NULL). All nest/label writes go through
-- /api/projects/* routes (service client) — RLS here is defense in depth.

create table job_projects (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  client              text not null default '',
  description         text,
  time_start          text,             -- HH:MM, optional "project timing"
  time_end            text,
  default_punctuality punctuality,      -- NULL = not set; pre-fill only, never written onto jobs
  created_by          uuid,
  r2_folder           text,             -- stamped app-side on insert: {YYYY-MM-DD}_{name-slug}_{8-char-code}
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()  -- PATCH route sets it explicitly
);

alter table jobs
  add column project_id     uuid references job_projects(id) on delete set null,
  add column time_inherited boolean not null default false;

create index jobs_project_id_idx on jobs(project_id) where project_id is not null;

-- Buckets/files can belong to a project instead of a job (project Files tab).
-- attachment_buckets.job_id was NOT NULL — exactly one owner from now on.
alter table attachment_buckets
  alter column job_id drop not null,
  add column project_id uuid references job_projects(id) on delete cascade,
  add constraint attachment_buckets_one_owner check (
    (job_id is not null and project_id is null)
    or (job_id is null and project_id is not null)
  );

-- files.job_id is already nullable (legacy rows may be NULL/NULL) — only
-- forbid BOTH owners being set at once.
alter table files
  add column project_id uuid references job_projects(id) on delete cascade,
  add constraint files_not_both_owners check (
    not (job_id is not null and project_id is not null)
  );

alter table job_projects enable row level security;

-- Every office role reads projects; installers get nothing (their queries
-- never touch this table; the job title carries the project name).
create policy "job_projects: office roles select"
  on job_projects for select to authenticated
  using (get_my_role() in ('sales','scheduler','admin','designer','coordinator','production'));

create policy "job_projects: managers write"
  on job_projects for all to authenticated
  using (get_my_role() in ('sales','scheduler','coordinator','admin'))
  with check (get_my_role() in ('sales','scheduler','coordinator','admin'));

-- Project-scoped files: SELECT already flows through the blanket by-role
-- files policies (0049/0050). INSERT for the client-side upload path in
-- AttachmentBuckets (project mode) — office manager roles only.
create policy "files: project files insert by managers"
  on files for insert to authenticated
  with check (
    project_id is not null
    and get_my_role() in ('sales','scheduler','coordinator','admin')
  );

-- Project buckets are created by the service client (POST /api/projects), and
-- bucket rename/update falls under 0025/0049's existing authenticated
-- policies — no new bucket policy needed.
