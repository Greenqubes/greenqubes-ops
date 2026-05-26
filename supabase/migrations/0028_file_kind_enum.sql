-- 0028_file_kind_enum.sql
-- Add url_link and production_instructions to the file_kind enum.
-- These values are used by AttachmentBuckets (url_link) and
-- ProductionReadySection (production_instructions) but were missing
-- from the original enum, causing all inserts of those kinds to fail.

ALTER TYPE file_kind ADD VALUE IF NOT EXISTS 'url_link';
ALTER TYPE file_kind ADD VALUE IF NOT EXISTS 'production_instructions';
