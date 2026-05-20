-- Migration: 0029_job_coordinators
-- Creates the job_coordinators join table with RLS policies

create table job_coordinators (
  job_id  uuid not null references jobs(id)  on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (job_id, user_id)
);

alter table job_coordinators enable row level security;

-- sales / scheduler / admin: full SELECT
create policy "coordinators_select_sched_sales_admin" on job_coordinators
  for select using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
        and users.role in ('sales', 'scheduler', 'admin')
    )
  );

-- sales / scheduler / admin: INSERT
create policy "coordinators_insert_sched_sales_admin" on job_coordinators
  for insert with check (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
        and users.role in ('sales', 'scheduler', 'admin')
    )
  );

-- sales / scheduler / admin: DELETE
create policy "coordinators_delete_sched_sales_admin" on job_coordinators
  for delete using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
        and users.role in ('sales', 'scheduler', 'admin')
    )
  );

-- installer: read-only SELECT
create policy "coordinators_select_installer" on job_coordinators
  for select using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
        and users.role = 'installer'
    )
  );
