-- 0041: store the original upload filename for in-app display.
-- R2 keys stay UUID-based; this is display-only metadata. Old rows stay NULL
-- (their original names are unrecoverable) and the app falls back to the key tail.
alter table files add column name text;
