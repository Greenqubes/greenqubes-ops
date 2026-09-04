-- 0053_installer_completed_visibility.sql
-- Installers can refer back to ANY completed job (Nic, 2026-09-04): the
-- Completed tab shows the whole company's past jobs regardless of who was
-- assigned, and an opened past job shows its files, photos, signed DO,
-- chat (Nic's call), task list and crew.
--
-- Additive SELECT-only policies (RLS policies OR together): pending and
-- scheduled visibility, every write path, and commercial data
-- (job_financials has its own policies) are all untouched.
--
-- job_is_completed() is SECURITY DEFINER for the same reason as
-- get_my_id()/get_my_role() in 0002: the 0037 jobs policy already
-- references job_assignees, so a job_assignees policy referencing jobs
-- directly would make RLS recurse (jobs ↔ job_assignees). The helper
-- leaks nothing but "is this job completed".

create or replace function job_is_completed(jid uuid)
returns boolean
language sql security definer stable
as $$
  select exists (select 1 from jobs where id = jid and status = 'completed');
$$;

-- ── jobs: every installer sees every completed job ───────────────────────────
drop policy if exists "jobs: installer sees completed" on jobs;
create policy "jobs: installer sees completed"
  on jobs for select to authenticated
  using (get_my_role() = 'installer' and status = 'completed');

-- ── files: photos / signed DO / attachments on completed jobs ────────────────
drop policy if exists "files: installer reads completed jobs" on files;
create policy "files: installer reads completed jobs"
  on files for select to authenticated
  using (
    get_my_role() = 'installer'
    and job_id is not null
    and job_is_completed(job_id)
  );

-- ── messages: job chat on completed jobs (chat visible too — Nic) ────────────
drop policy if exists "messages: installer reads completed jobs" on messages;
create policy "messages: installer reads completed jobs"
  on messages for select to authenticated
  using (get_my_role() = 'installer' and job_is_completed(job_id));

-- ── job_tasks: task list on completed jobs (read-only; ticking stays
--    formally-assigned-only per 0039) ──────────────────────────────────────────
drop policy if exists "tasks: installer reads completed jobs" on job_tasks;
create policy "tasks: installer reads completed jobs"
  on job_tasks for select to authenticated
  using (get_my_role() = 'installer' and job_is_completed(job_id));

-- ── job_assignees: crew rows on completed jobs, so "who did this job"
--    shows. Formal rows only — suggestions stay invisible to installers
--    everywhere (0037 rule) ────────────────────────────────────────────────────
drop policy if exists "assignees: installer reads completed crews" on job_assignees;
create policy "assignees: installer reads completed crews"
  on job_assignees for select to authenticated
  using (
    get_my_role() = 'installer'
    and is_suggestion = false
    and job_is_completed(job_id)
  );
