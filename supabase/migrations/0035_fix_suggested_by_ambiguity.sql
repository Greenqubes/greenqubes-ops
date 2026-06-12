-- 0035_fix_suggested_by_ambiguity.sql
-- HOTFIX: 0033 added suggested_by with an FK to users, giving job_assignees
-- TWO relationships to users. PostgREST then rejects every
-- `job_assignees ( users (...) )` embed with PGRST201 (ambiguous embed),
-- which crashed /schedule, job detail, and overdue notifications on ALL
-- deployments sharing this DB.
--
-- Fix: drop the FK constraint. The column stays — Phase 2 writes user ids
-- into it and validates in app code. If an FK is ever re-added, every embed
-- must first be rewritten as users!job_assignees_user_id_fkey (...).

ALTER TABLE job_assignees DROP CONSTRAINT IF EXISTS job_assignees_suggested_by_fkey;
