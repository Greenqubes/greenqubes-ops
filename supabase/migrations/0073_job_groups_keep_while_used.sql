-- 0073_job_groups_keep_while_used.sql
-- A job group still holding a job can no longer be deleted (Nic, 2026-11-13:
-- "fix those", the groups final review's deferred minors).
--
-- Number claimed 2026-11-13: live DB (migration list) at 0072; every branch
-- (local and origin) tops out at 0072.
--
-- Why: 0072 made jobs.group_id "on delete set null", so deleting a group
-- quietly unfolded every job in it. POST /api/job-groups deletes a group it
-- has just counted as empty; if someone added a job between that count and
-- the delete, the job was unfolded again without anyone asking. With the
-- default rule (no action) the database refuses that delete instead (23503),
-- and the route reads the refusal as "still in use" and keeps the group.
-- Ungroup now takes the jobs out first, then deletes the group
-- (src/lib/utils/job-group-change.ts).
--
-- Only the rule changes: same column, same name, nothing else on jobs.

alter table public.jobs drop constraint jobs_group_id_fkey;
alter table public.jobs
  add constraint jobs_group_id_fkey foreign key (group_id) references public.job_groups(id);
