-- 0056_sales_complete_own_jobs.sql
-- Sales can close off their OWN job, the way the scheduler already can
-- (Nic, 2026-09-07).
--
-- Why: the overdue reminder is sent to the job's sales POC
-- (src/app/api/notifications/overdue/route.ts), so a sales person was being
-- nagged about jobs they had no way to close. Only the POC gains this — another
-- sales person's job stays untouchable, which is what the existing
-- sales_poc_id = get_my_id() arm already enforces. Scheduler and admin keep
-- closing any job anywhere, unchanged.
--
-- The change is ONE value, in WITH CHECK only:
--   USING      = which rows sales may edit   -> unchanged (NOT completed)
--   WITH CHECK = what they may become        -> gains 'completed'
--
-- Keeping 'completed' OUT of USING is deliberate, and mirrors how this already
-- behaves for every other office role: the moment a job is completed it leaves
-- the sales row set, so it cannot be edited further. The job form is read-only
-- on a completed job anyway (readOnly = completed), and the way back is the
-- Revert button, which runs through /api/jobs/[id]/revert-complete — that route
-- allows every role except installer, so a sales person can always undo their
-- own accidental close. Nobody gets locked out of their own job.
--
-- Installers are unaffected: they hold NO jobs UPDATE policy at all and
-- complete through the service-client route /api/jobs/[id]/complete, which is
-- gated to installers only and bypasses RLS entirely.
--
-- Paired client change: handleStatusChange now asks for the updated row back
-- and treats an empty result as a failure, so a status change refused by RLS
-- can no longer report "Saved successfully" — the same trap 0055 fixed for
-- field edits.

DROP POLICY IF EXISTS "jobs: sales can update own pending or scheduled jobs" ON jobs;

CREATE POLICY "jobs: sales can update own pending or scheduled jobs"
  ON jobs FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'sales' AND
    sales_poc_id = get_my_id() AND
    status IN ('pending', 'awaiting_approval', 'scheduled')
  )
  WITH CHECK (
    get_my_role() = 'sales' AND
    sales_poc_id = get_my_id() AND
    status IN ('pending', 'awaiting_approval', 'scheduled', 'completed')
  );
