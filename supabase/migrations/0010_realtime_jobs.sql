-- Enable realtime on the jobs table so schedule updates live for all roles.
--
-- Also replaces SECURITY DEFINER-based SELECT policies on jobs with direct
-- auth.uid() subqueries — same fix applied to messages + files in 0008,
-- required for Supabase Realtime to evaluate RLS correctly.

-- Add jobs to realtime publication (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'jobs'
  ) then
    alter publication supabase_realtime add table jobs;
  end if;
end $$;

-- Drop old SECURITY DEFINER-based SELECT policies on jobs
drop policy if exists "jobs: sales and scheduler see all"   on jobs;
drop policy if exists "jobs: installer sees assigned only"  on jobs;

-- Replacement SELECT policies using auth.uid() directly (realtime-compatible)
create policy "jobs: select by role or assignment"
  on jobs for select
  to authenticated
  using (
    auth.uid() in (
      select u.auth_id from users u
      where u.role in ('sales', 'scheduler')
      union
      select u.auth_id from users u
      join job_assignees ja on ja.user_id = u.id
      where ja.job_id = jobs.id
    )
  );
