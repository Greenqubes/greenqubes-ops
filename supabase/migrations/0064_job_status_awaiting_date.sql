-- 0064 — the office-visible Pending stage (spec 2026-10-09-job-stages-design.md)
--
-- Its own migration on purpose: Postgres cannot use a new enum value inside
-- the transaction that adds it (the 0018/0019 and 0057 rule).
--
-- NAMING, read before touching job statuses: `pending` stays a PRIVATE DRAFT
-- (0062, unchanged). `awaiting_date` is the new office-visible Pending stage.
-- Screens translate through src/lib/utils/job-stage.ts.
alter type job_status add value if not exists 'awaiting_date';
