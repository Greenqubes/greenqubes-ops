-- =============================================================
-- Greenqubes ops platform — Row Level Security policies
-- Apply after 0001_schema.sql
-- =============================================================
--
-- Access model:
--   sales      — all jobs, all clients, all commercial data
--   scheduler  — same as sales + approval powers + audit log
--   installer  — assigned jobs only, zero commercial data
--
-- Helper functions use SECURITY DEFINER so they bypass RLS when
-- looking up the caller's own users row, preventing recursion.
-- =============================================================

create or replace function get_my_id()
returns uuid
language sql security definer stable
as $$
  select id from users where auth_id = auth.uid();
$$;

create or replace function get_my_role()
returns text
language sql security definer stable
as $$
  select role::text from users where auth_id = auth.uid();
$$;

-- Enable RLS on every table
alter table users         enable row level security;
alter table jobs          enable row level security;
alter table job_financials enable row level security;
alter table job_assignees  enable row level security;
alter table files          enable row level security;
alter table messages       enable row level security;
alter table asst_chats     enable row level security;
alter table kb_chunks      enable row level security;
alter table events         enable row level security;

-- =============================================================
-- users
-- All team members can see each other (needed for assignment UI
-- and chat author display). Only own record is updatable.
-- Inserts/deletes go through service role only.
-- =============================================================
create policy "users: all authenticated can read"
  on users for select
  to authenticated
  using (true);

create policy "users: own record update only"
  on users for update
  to authenticated
  using  (auth_id = auth.uid())
  with check (auth_id = auth.uid());

-- =============================================================
-- jobs
-- =============================================================
create policy "jobs: sales and scheduler see all"
  on jobs for select
  to authenticated
  using (get_my_role() in ('sales', 'scheduler'));

create policy "jobs: installer sees assigned only"
  on jobs for select
  to authenticated
  using (
    get_my_role() = 'installer' and
    exists (
      select 1 from job_assignees ja
      where ja.job_id = jobs.id
        and ja.user_id = get_my_id()
    )
  );

create policy "jobs: sales and scheduler can insert"
  on jobs for insert
  to authenticated
  with check (get_my_role() in ('sales', 'scheduler'));

create policy "jobs: scheduler can update any"
  on jobs for update
  to authenticated
  using (get_my_role() = 'scheduler');

-- Sales can edit only their own jobs while still in draft/review
create policy "jobs: sales can update own pending jobs"
  on jobs for update
  to authenticated
  using (
    get_my_role() = 'sales' and
    sales_poc_id = get_my_id() and
    status in ('pending', 'awaiting_approval')
  );

-- Installer completion updates go through a server-side API route
-- (service role) so we can enforce column-level restrictions there.
-- No installer UPDATE policy here is intentional.

create policy "jobs: scheduler can delete"
  on jobs for delete
  to authenticated
  using (get_my_role() = 'scheduler');

-- =============================================================
-- job_financials  (sales + scheduler only — installers blocked)
-- =============================================================
create policy "financials: sales and scheduler select"
  on job_financials for select
  to authenticated
  using (get_my_role() in ('sales', 'scheduler'));

create policy "financials: sales and scheduler insert"
  on job_financials for insert
  to authenticated
  with check (get_my_role() in ('sales', 'scheduler'));

create policy "financials: sales and scheduler update"
  on job_financials for update
  to authenticated
  using  (get_my_role() in ('sales', 'scheduler'))
  with check (get_my_role() in ('sales', 'scheduler'));

-- =============================================================
-- job_assignees
-- =============================================================
create policy "assignees: sales and scheduler see all"
  on job_assignees for select
  to authenticated
  using (get_my_role() in ('sales', 'scheduler'));

create policy "assignees: installer sees own rows"
  on job_assignees for select
  to authenticated
  using (
    get_my_role() = 'installer' and
    user_id = get_my_id()
  );

create policy "assignees: sales and scheduler insert"
  on job_assignees for insert
  to authenticated
  with check (get_my_role() in ('sales', 'scheduler'));

create policy "assignees: sales and scheduler delete"
  on job_assignees for delete
  to authenticated
  using (get_my_role() in ('sales', 'scheduler'));

-- =============================================================
-- files
-- =============================================================
create policy "files: sales and scheduler see all"
  on files for select
  to authenticated
  using (get_my_role() in ('sales', 'scheduler'));

create policy "files: installer sees files on assigned jobs"
  on files for select
  to authenticated
  using (
    get_my_role() = 'installer' and
    exists (
      select 1 from job_assignees ja
      where ja.job_id = files.job_id
        and ja.user_id = get_my_id()
    )
  );

create policy "files: sales and scheduler insert"
  on files for insert
  to authenticated
  with check (get_my_role() in ('sales', 'scheduler'));

create policy "files: installer uploads to assigned jobs"
  on files for insert
  to authenticated
  with check (
    get_my_role() = 'installer' and
    uploader_id = get_my_id() and
    exists (
      select 1 from job_assignees ja
      where ja.job_id = files.job_id
        and ja.user_id = get_my_id()
    )
  );

-- =============================================================
-- messages
-- =============================================================
create policy "messages: sales and scheduler see all"
  on messages for select
  to authenticated
  using (get_my_role() in ('sales', 'scheduler'));

create policy "messages: installer sees thread on assigned jobs"
  on messages for select
  to authenticated
  using (
    get_my_role() = 'installer' and
    exists (
      select 1 from job_assignees ja
      where ja.job_id = messages.job_id
        and ja.user_id = get_my_id()
    )
  );

create policy "messages: sales and scheduler post"
  on messages for insert
  to authenticated
  with check (
    get_my_role() in ('sales', 'scheduler') and
    author_id = get_my_id()
  );

create policy "messages: installer posts to assigned jobs"
  on messages for insert
  to authenticated
  with check (
    get_my_role() = 'installer' and
    author_id = get_my_id() and
    exists (
      select 1 from job_assignees ja
      where ja.job_id = messages.job_id
        and ja.user_id = get_my_id()
    )
  );

-- =============================================================
-- asst_chats
-- Private by default. Scheduler has read-across for oversight.
-- Multiple SELECT policies are OR'd by Postgres.
-- =============================================================
create policy "asst_chats: own records"
  on asst_chats for select
  to authenticated
  using (user_id = get_my_id());

create policy "asst_chats: scheduler reads all"
  on asst_chats for select
  to authenticated
  using (get_my_role() = 'scheduler');

create policy "asst_chats: own insert"
  on asst_chats for insert
  to authenticated
  with check (user_id = get_my_id());

create policy "asst_chats: own update"
  on asst_chats for update
  to authenticated
  using (user_id = get_my_id());

-- =============================================================
-- kb_chunks  (visibility-token based access)
-- Tokens: 'public-internal', 'role:sales', 'role:scheduler',
--         'role:installer', 'private:<user_id>'
-- Insert/update/delete only via service role (obsidian-sync script).
-- =============================================================
create policy "kb_chunks: visibility token check"
  on kb_chunks for select
  to authenticated
  using (
    'public-internal'                    = any(visibility) or
    ('role:' || get_my_role())           = any(visibility) or
    ('private:' || get_my_id()::text)    = any(visibility)
  );

-- =============================================================
-- events  (append-only audit log)
-- Scheduler can read. No authenticated writes — service role only.
-- =============================================================
create policy "events: scheduler can read"
  on events for select
  to authenticated
  using (get_my_role() = 'scheduler');
