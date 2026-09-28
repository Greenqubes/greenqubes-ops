-- 0062_pending_privacy.sql
--
-- Pending jobs are private to the people who share them (Nic, 2026-09-28).
-- Until now the jobs SELECT policy (0060) let sales, scheduler, admin and
-- coordinator read EVERY draft, and the Pending tab listed all of them.
--
-- Sharers: jobs.created_by, jobs.sales_poc_id, job_coordinators.user_id.
-- Admin sees all. Scheduled / completed jobs are untouched by this file.
--
-- HOW: one RESTRICTIVE policy per table. Postgres ANDs restrictive policies
-- with the permissive ones, so none of the ~60 existing policies is edited —
-- each keeps deciding what it decided before, and this only ever removes
-- drafts the caller does not share. Mirror: src/lib/auth/pending-privacy.ts.
--
-- SECURITY DEFINER for the same reason as job_is_completed() (0053): the
-- checks read job_coordinators and jobs, whose own policies read each other,
-- and a plain subquery would recurse.

create or replace function pending_job_hidden(
  p_status text, p_created_by uuid, p_sales_poc_id uuid, p_job_id uuid
) returns boolean
language sql security definer stable
set search_path = public
as $$
  select p_status in ('pending', 'awaiting_approval')
     and coalesce(get_my_role(), '') <> 'admin'
     and get_my_id() is distinct from p_created_by
     and get_my_id() is distinct from p_sales_poc_id
     and not exists (
       select 1 from job_coordinators c
       where c.job_id = p_job_id and c.user_id = get_my_id()
     );
$$;

-- For linked tables. A job that does not exist is NOT hidden: that is the
-- moment a row is being inserted alongside a brand-new job, and the insert
-- policies already decide that case.
create or replace function job_hidden_from_me(p_job_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce(
    (select pending_job_hidden(j.status::text, j.created_by, j.sales_poc_id, j.id)
       from jobs j where j.id = p_job_id),
    false);
$$;

-- ── jobs ─────────────────────────────────────────────────────────────────────
-- Row columns, not job_hidden_from_me(id): during INSERT … RETURNING the new
-- row is not yet visible to a separate query, but its own columns are —
-- including created_by, stamped by the BEFORE INSERT trigger (0050).
drop policy if exists "jobs: pending private select" on jobs;
create policy "jobs: pending private select"
  on jobs as restrictive for select to authenticated
  using (not pending_job_hidden(status::text, created_by, sales_poc_id, id));

-- UPDATE: WITH CHECK (true) so a sharer can hand a draft to another PIC or
-- push it to the schedule — the row may stop being theirs after the write.
drop policy if exists "jobs: pending private update" on jobs;
create policy "jobs: pending private update"
  on jobs as restrictive for update to authenticated
  using (not pending_job_hidden(status::text, created_by, sales_poc_id, id))
  with check (true);

drop policy if exists "jobs: pending private delete" on jobs;
create policy "jobs: pending private delete"
  on jobs as restrictive for delete to authenticated
  using (not pending_job_hidden(status::text, created_by, sales_poc_id, id));

-- ── linked tables: follow the job ────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'files', 'messages', 'attachment_buckets', 'job_tasks', 'job_financials',
    'job_external_contacts', 'job_assignees', 'job_coordinators',
    'job_designers', 'design_scores', 'job_chat_state'
  ] loop
    execute format('drop policy if exists "pending private" on %I', t);
    execute format(
      'create policy "pending private" on %I as restrictive for all to authenticated
         using (not job_hidden_from_me(job_id))
         with check (not job_hidden_from_me(job_id))', t);
  end loop;
end $$;
