-- 0055_sales_edit_scheduled_jobs.sql
-- Sales can amend their OWN job after it has been pushed to the schedule
-- (Nic, 2026-09-07, after a director hit this on a live job).
--
-- The bug: 0036 split USING from WITH CHECK so sales could push a job to
-- 'scheduled', but left USING at ('pending','awaiting_approval'). The moment a
-- job became scheduled it left the sales UPDATE policy's row set entirely, so
-- every later edit by that sales person matched ZERO rows.
--
-- Why it looked like a save: an UPDATE filtered out by RLS is not an error.
-- PostgREST returns 204 with no rows and no error, so the client's
-- .throwOnError() passed, the form reset, and the toast said "Saved
-- successfully" — while the date (and every other field) was silently
-- discarded. The client now asks for the updated row back and treats an empty
-- result as a failure, so a blocked write can never masquerade as a save again.
--
-- Scope: USING gains 'scheduled' ONLY. The sales_poc_id = get_my_id() arm is
-- untouched, so a sales person still edits only their own jobs and still
-- cannot touch anyone else's. WITH CHECK already listed 'scheduled' (0036) and
-- is restated here unchanged so the whole policy reads in one place. Completed
-- jobs remain outside the set — they were never in it, and the form is
-- read-only there anyway.
--
-- Paired UI change: JobDetailShell now runs the same scheduled-job clash
-- pre-flight for sales that coordinator already gets on a date/time change
-- (assign-installers?checkOnly=true, whose own gate gains 'sales'). That gate
-- is read-only and sits above the write gate, which stays scheduler/admin
-- only — so this widens no mutation path beyond the policy below.

DROP POLICY IF EXISTS "jobs: sales can update own pending jobs" ON jobs;

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
    status IN ('pending', 'awaiting_approval', 'scheduled')
  );
