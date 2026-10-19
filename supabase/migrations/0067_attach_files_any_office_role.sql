-- 0067 — every role except installers may ATTACH files on a job in progress
-- (Nic, 2026-10-19).
--
-- "Ongoing job means job is progressing, so a designer can start work before
-- they are assigned." On Ongoing (awaiting_date) and Scheduled jobs, any
-- designer and HR / Finance may now add attachments and links to a job's
-- folders. Before this:
--   designer — only on jobs they are assigned to (0048 "files: designers
--              upload to assigned jobs");
--   hr       — no insert at all (0058 made her job page read-only).
-- Sales, scheduler, admin, coordinator and production already hold INSERT
-- (0050); installers stay out entirely.
--
-- Additive only: no existing policy or row changes. ADD only — renaming or
-- deleting folders and other people's files keeps its existing rules
-- (canManageJobFiles / the /api/files and /api/buckets routes).
-- Drafts are untouched: a draft's status is 'pending', which is not in the
-- list, and the 0062 restrictive "pending private" policy on files still
-- applies on top. Completed jobs are not in the list either.
--
-- The jobs lookup runs under the caller's own RLS: designers (0060) and hr
-- (0058) can already read awaiting_date and scheduled jobs, so the EXISTS
-- sees the row. jobs' policies do not read files, so there is no recursion.
-- No new table, so the 2026-10-30 grants rule does not apply.

drop policy if exists "files: attach on jobs in progress (designer, hr)" on files;
create policy "files: attach on jobs in progress (designer, hr)"
  on files for insert to authenticated
  with check (
    get_my_role() in ('designer', 'hr')
    and kind in ('attachment', 'url_link')
    and job_id is not null
    and exists (
      select 1 from jobs j
      where j.id = files.job_id
        and j.status in ('awaiting_date', 'scheduled')
    )
  );
