-- 0065 — job stages: an optional date before scheduling, sales edit rights
-- on Pending (spec 2026-10-09-job-stages-design.md, Nic 2026-10-09).
--
-- SAFE BEFORE THE NEW CODE IS LIVE: preview and production share this
-- database. Old code always writes a date and never writes awaiting_date,
-- so nothing here changes what it can see or do. No existing row is touched.
--
-- Already right with NO edit, checked 2026-10-09:
--   0060 "designer and production see non-pending" — awaiting_date is not in
--        its exclusion list, so they see Pending jobs.
--   0058 "readonly role non-pending select" (hr) — same.
--   0062 pending privacy — keys off ('pending','awaiting_approval'), i.e. Drafts.
--   0019 scheduler/admin and 0037 coordinator/production UPDATE — blanket.
--   Installers (0037 assigned, 0053 completed) — formal crew is refused on
--        awaiting_date by the routes, so 0037 can never match one.

-- 1. A date is optional until a job is on the schedule.
alter table jobs alter column date drop not null;
alter table jobs drop constraint if exists jobs_date_required_when_scheduled;
alter table jobs add constraint jobs_date_required_when_scheduled
  check (date is not null or status in ('pending', 'awaiting_approval', 'awaiting_date'));

-- 1b. The readable R2 folder (0042) is stamped from the date at INSERT. With
--     no date, to_char(NULL) made the whole name NULL; uploads still worked
--     (they fall back to jobs/{id}/) but the folder lost its readable name.
--     Same function, 'undated' in place of a missing date. Stamped once at
--     insert, as before — a date set later does not rename the folder.
create or replace function public.stamp_r2_folder()
returns trigger language plpgsql as $$
declare
  slug text;
begin
  slug := regexp_replace(coalesce(new.project_title, ''), '[^[:alnum:]]+', '-', 'g');
  slug := trim(both '-' from slug);
  if slug = '' then slug := 'Untitled'; end if;
  slug := trim(both '-' from left(slug, 50));
  new.r2_folder := coalesce(to_char(new.date::date, 'YYYY-MM-DD'), 'undated') || '_' || slug || '_' || left(new.id::text, 8);
  return new;
end;
$$;

-- 2. Sales edit their own Pending jobs, as they already do drafts and
--    scheduled ones (0056 + awaiting_date in both clauses).
drop policy if exists "jobs: sales can update own pending or scheduled jobs" on jobs;
create policy "jobs: sales can update own pending or scheduled jobs"
  on jobs for update to authenticated
  using (
    get_my_role() = 'sales' and
    sales_poc_id = get_my_id() and
    status in ('pending', 'awaiting_approval', 'awaiting_date', 'scheduled')
  )
  with check (
    get_my_role() = 'sales' and
    sales_poc_id = get_my_id() and
    status in ('pending', 'awaiting_approval', 'awaiting_date', 'scheduled', 'completed')
  );
