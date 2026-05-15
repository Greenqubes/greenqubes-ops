-- 0018_admin_role_enum.sql
-- Adds 'admin' to the user_role enum.
-- Must be a separate migration from any statements that USE the new value
-- (Postgres constraint: enum values added in a transaction are not visible
-- within that same transaction).

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
