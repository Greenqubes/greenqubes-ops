-- 0036_sales_push_to_scheduled.sql
-- Workflow V2: sales pushes pending jobs directly to scheduled.
-- The old policy had no WITH CHECK, so the USING clause
-- (status IN pending/awaiting_approval) also applied to the NEW row —
-- rejecting the pending → scheduled transition with an RLS error.
-- Split USING (which rows sales may edit: own, still pending/awaiting)
-- from WITH CHECK (what they may change them to: + scheduled).

DROP POLICY IF EXISTS "jobs: sales can update own pending jobs" ON jobs;

CREATE POLICY "jobs: sales can update own pending jobs"
  ON jobs FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'sales' AND
    sales_poc_id = get_my_id() AND
    status IN ('pending', 'awaiting_approval')
  )
  WITH CHECK (
    get_my_role() = 'sales' AND
    sales_poc_id = get_my_id() AND
    status IN ('pending', 'awaiting_approval', 'scheduled')
  );
