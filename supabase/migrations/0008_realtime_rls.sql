-- =============================================================
-- Fix Supabase Realtime RLS incompatibility on messages + files
--
-- Root cause: existing SELECT policies use SECURITY DEFINER
-- functions (get_my_role, get_my_id) that call auth.uid()
-- internally. The Realtime engine runs in a separate Postgres
-- session where these functions silently fail, causing it to
-- drop all events before delivery.
--
-- Fix: replace with direct auth.uid() subqueries that the
-- Realtime engine can evaluate correctly.
-- =============================================================

-- messages: drop old custom-function-based SELECT policies
drop policy if exists "messages: sales and scheduler see all" on messages;
drop policy if exists "messages: installer sees thread on assigned jobs" on messages;

-- messages: single combined SELECT policy using auth.uid() directly
create policy "messages: select by role or assignment"
  on messages for select
  to authenticated
  using (
    auth.uid() in (
      select u.auth_id from users u
      where u.role in ('sales', 'scheduler')
      union
      select u.auth_id from users u
      join job_assignees ja on ja.user_id = u.id
      where ja.job_id = messages.job_id
    )
  );

-- files: drop old custom-function-based SELECT policies
drop policy if exists "files: sales and scheduler see all" on files;
drop policy if exists "files: installer sees files on assigned jobs" on files;

-- files: single combined SELECT policy using auth.uid() directly
create policy "files: select by role or assignment"
  on files for select
  to authenticated
  using (
    auth.uid() in (
      select u.auth_id from users u
      where u.role in ('sales', 'scheduler')
      union
      select u.auth_id from users u
      join job_assignees ja on ja.user_id = u.id
      where ja.job_id = files.job_id
    )
  );
