-- Broadcast installer assignments and task-list changes.
-- job_assignees and job_tasks were never added to the realtime publication,
-- so the FCFS board's assignee listener had no events to receive and the new
-- live features (installer dashboard, job form) need them too. Additive and
-- idempotent — safe to apply while production is live; nothing changes until
-- the UI subscribes. Delivery respects RLS per-row (0037/0039 policies), so
-- installers never receive suggestion rows.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'job_assignees'
  ) then
    alter publication supabase_realtime add table job_assignees;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'job_tasks'
  ) then
    alter publication supabase_realtime add table job_tasks;
  end if;
end $$;

-- Full old-row images so DELETE/UPDATE payloads carry all columns
-- (same as 0009 for messages/files and 0011 for jobs).
alter table job_assignees replica identity full;
alter table job_tasks     replica identity full;
