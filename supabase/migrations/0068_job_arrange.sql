-- To arrange (spec docs/superpowers/specs/2026-11-04-to-arrange-design.md).
-- Sales marks an Ongoing job ready with a day/time guide; the scheduler
-- offers a slot; sales checks it with the client; Client OK schedules it.
--
-- Columns on jobs, not a table: the Bin snapshot (0063 copies the whole
-- row), pending privacy (0062 hides the whole row) and realtime (jobs is
-- already published) all cover them with no extra work — and no new table
-- means no Data API grants to add. Additive only: previews share the
-- production database, and no deployed code reads these until the feature
-- ships.
--
--   arrange_state  whose turn it is — null = not in To arrange
--   arrangement    the guide, the current offer and the last "sent back"
--                  reason, shaped by src/lib/utils/arrange-rules.ts
alter table public.jobs
  add column arrange_state text
    constraint jobs_arrange_state_valid
    check (arrange_state in ('needs_date', 'offered', 'no_fit', 'clash')),
  add column arrangement jsonb;

-- Only an Ongoing job (raw awaiting_date) can be in To arrange. Every path
-- that moves a job out of Ongoing must clear both columns in the SAME
-- update — /api/jobs/[id]/submit and /api/jobs/[id]/stage do, from the
-- release that ships this feature.
alter table public.jobs
  add constraint jobs_arrange_only_ongoing
  check (arrange_state is null or status = 'awaiting_date');
