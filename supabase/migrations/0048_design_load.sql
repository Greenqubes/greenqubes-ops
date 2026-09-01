-- Migration: 0048_design_load
-- Designer Load Flow: job_designers join table, design columns on jobs,
-- design_scores history, design_brief file kind, realtime for job_designers.

-- 1. job_designers (mirrors 0029 job_coordinators)
create table job_designers (
  job_id      uuid not null references jobs(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (job_id, user_id)
);

alter table job_designers enable row level security;

-- Office roles + designers can read (Design Load is a shared view)
create policy "designers_select_office" on job_designers
  for select using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
        and users.role in ('sales','scheduler','coordinator','designer','production','admin')
    )
  );

-- sales / scheduler / coordinator / admin manage the list
create policy "designers_insert_managers" on job_designers
  for insert with check (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
        and users.role in ('sales','scheduler','coordinator','admin')
    )
  );

create policy "designers_delete_managers" on job_designers
  for delete using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
        and users.role in ('sales','scheduler','coordinator','admin')
    )
  );

-- 2. design columns on jobs (all nullable — old rows unaffected)
alter table jobs
  add column design_brief        text,
  add column design_due_date     date,
  add column design_due_manual   boolean not null default false,
  add column design_complexity   int check (design_complexity between 1 and 5),
  add column design_confidence   text check (design_confidence in ('ok','low')),
  add column design_score_reason text,
  add column design_scored_at    timestamptz,
  add column design_completed_at timestamptz,
  add column design_completed_by uuid,  -- plain uuid, NO users FK (the 0035 lesson)
  add column design_rated_complexity int check (design_rated_complexity between 1 and 5),
  add column design_rating_suspect boolean not null default false,
  add column design_rating_resolution text check (design_rating_resolution in ('kept','discarded'));

-- 3. design_scores append-only history (admin AI Scores tab)
create table design_scores (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  trigger_kind text not null check (trigger_kind in ('brief_change','assign','date_change','nightly')),
  model        text not null,
  complexity   int not null check (complexity between 1 and 5),
  proposed_due date,
  reason       text not null,
  confidence   text not null check (confidence in ('ok','low')),
  created_at   timestamptz not null default now()
);

alter table design_scores enable row level security;

-- admin read-only; rows are written by the service client (bypasses RLS)
create policy "design_scores_select_admin" on design_scores
  for select using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid() and users.role = 'admin'
    )
  );

create index design_scores_job_idx on design_scores (job_id, created_at desc);

-- 4. design_brief file kind (0028 pattern)
alter type file_kind add value if not exists 'design_brief';

-- 5. realtime for job_designers (0043 pattern)
alter table job_designers replica identity full;
alter publication supabase_realtime add table job_designers;

-- 6. Files INSERT policy for designers (Step 1 check confirmed role-restricted policy excludes designer)
create policy "files: designers upload to assigned jobs"
  on files for insert
  to authenticated
  with check (
    get_my_role() = 'designer' and
    uploader_id = get_my_id() and
    exists (
      select 1 from job_designers jd
      where jd.job_id = files.job_id
        and jd.user_id = get_my_id()
    )
  );
