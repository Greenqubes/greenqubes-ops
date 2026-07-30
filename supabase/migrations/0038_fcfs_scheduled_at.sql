-- 0038_fcfs_scheduled_at.sql
-- FCFS rank counts from when a job LANDED ON THE SCHEDULE, not when it was
-- created — sales can't see each other's pending jobs, so creation order
-- would be opaque to them (Nic, 2026-07-22). A trigger stamps every
-- transition into 'scheduled', covering the V2 push route, status edits,
-- and any code path still deployed on dev/main (backward-compatible: old
-- code never touches the column, the trigger does the work).
-- Re-pushing a recalled job takes a fresh slot at the back of the queue.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

CREATE OR REPLACE FUNCTION stamp_scheduled_at()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'scheduled'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'scheduled') THEN
    NEW.scheduled_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_stamp_scheduled_at ON jobs;
CREATE TRIGGER trg_jobs_stamp_scheduled_at
  BEFORE INSERT OR UPDATE OF status ON jobs
  FOR EACH ROW EXECUTE FUNCTION stamp_scheduled_at();

-- Backfill so existing scheduled/completed jobs keep their current order.
UPDATE jobs SET scheduled_at = created_at
WHERE scheduled_at IS NULL AND status IN ('scheduled', 'completed');
