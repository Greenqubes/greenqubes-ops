-- =============================================================
-- 0061 — job location coordinates
--
-- Captured from the Google Places pick on the job form (Nic, 2026-09-16).
-- `location` sits in Google's Essentials SKU, the same tier as the
-- formattedAddress the form already requests, so this costs nothing extra:
-- one more field in a request we were already making.
--
-- NOTHING READS THESE COLUMNS YET, on purpose. They exist so that when the
-- "which driver is already near this job" hint is designed, there is real
-- data behind it instead of an empty table. Do not delete them as dead code
-- — see docs/context.md, 2026-09-16.
--
-- Additive and nullable: every existing job keeps NULL, and no deployed code
-- path requires a value. Jobs whose address was typed rather than picked
-- stay NULL for ever unless someone re-picks the address.
--
-- Number claimed 2026-09-16 after checking the live DB (highest remote 0060)
-- AND every branch, local and remote (highest anywhere 0060) — the standing
-- rule, because a duplicate number is silently skipped by db push.
-- =============================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lng double precision;

COMMENT ON COLUMN jobs.lat IS 'Latitude of the picked Google Place. NULL when typed by hand. Unused by any code as of 0061 — deliberate capture for a future proximity feature.';
COMMENT ON COLUMN jobs.lng IS 'Longitude of the picked Google Place. NULL when typed by hand. Unused by any code as of 0061 — deliberate capture for a future proximity feature.';
