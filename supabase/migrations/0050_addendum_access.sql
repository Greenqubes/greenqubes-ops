-- 0050_addendum_access.sql
-- Designer Load Flow addendum (Nic, 2026-08-27 — approved before the smoke
-- test): coordinator gains sales-level job/file access, jobs get a
-- "created by" trail, and production's files access is squared up. All
-- changes additive on the shared prod DB — nothing existing loses access.

-- ── 1. jobs.created_by ───────────────────────────────────────────────────
-- Plain uuid, NO FK to users (the 0035 lesson: a third users FK on jobs
-- broke every `job_assignees ( users (...) )` PostgREST embed with
-- PGRST201 — jobs already carries sales_poc_id and would break the same
-- way). Stamped by a BEFORE INSERT trigger reading the caller's users row,
-- same stamp-once-at-creation shape as 0042's r2_folder trigger (0038's
-- scheduled_at trigger also fires on UPDATE OF status — not needed here,
-- created_by never changes after creation). Client-authenticated inserts
-- (the New Job form) go through get_my_id(), same helper the RLS policies
-- already use. Service-role inserts carry no auth.uid() session, so
-- get_my_id() resolves to null there — the two service-client create paths
-- (duplicate route, assistant job-create) set created_by explicitly before
-- the trigger runs; the trigger only fills the gap when it's still null.
-- Pre-existing jobs keep created_by NULL — no backfill (spec: "Pre-existing
-- jobs show nothing").
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE OR REPLACE FUNCTION stamp_jobs_created_by()
RETURNS trigger AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := get_my_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_stamp_created_by ON jobs;
CREATE TRIGGER trg_jobs_stamp_created_by
  BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION stamp_jobs_created_by();

-- ── 2. jobs: coordinator gains sales-level create access ────────────────
-- INSERT: coordinator joins sales/scheduler/admin (0019's set) so
-- coordinators can create jobs from the New Job form.
DROP POLICY IF EXISTS "jobs: sales and scheduler can insert" ON jobs;
CREATE POLICY "jobs: sales and scheduler can insert"
  ON jobs FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin', 'coordinator'));

-- pending -> scheduled transition: NO POLICY CHANGE NEEDED — verified, not
-- assumed. "jobs: coordinator and production can update" (0037) has a
-- USING clause and no WITH CHECK; per Postgres RLS semantics an UPDATE
-- policy with no WITH CHECK reuses USING for both, so that policy's
-- effective WITH CHECK is also just `get_my_role() IN ('coordinator',
-- 'production')` — no status restriction at all, unlike sales's scoped
-- 0036 policy (own jobs, pending/awaiting_approval -> scheduled only).
-- Coordinator can already push any job through pending -> scheduled today.
-- Checked every migration that has ever touched a jobs UPDATE policy —
-- 0002, 0019, 0036, 0037 — and confirmed no migration after 0037 touches
-- "jobs: coordinator and production can update".

-- ── 3. files: select by role — recreated as a documented superset ───────
-- History: 0024 (sales, scheduler, admin) -> 0049 (+ designer). This
-- version adds coordinator (addendum #2 — sales-parity Files tab, closes
-- the empty-Files-tab gap) and production (addendum #4 — production reads
-- every job's files, same as the other office roles). Full included set
-- after this migration: sales, scheduler, admin, designer, coordinator,
-- production. Installer is intentionally absent here — it keeps its
-- separate assignment-scoped "files: select by assignment" policy (0024),
-- unchanged.
DROP POLICY IF EXISTS "files: select by role" ON files;
CREATE POLICY "files: select by role"
  ON files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.role::text IN ('sales', 'scheduler', 'admin', 'designer', 'coordinator', 'production')
    )
  );

-- ── 4. files: sales and scheduler insert — recreated as a documented
-- superset ─────────────────────────────────────────────────────────────
-- Adds coordinator (addendum #2, sales parity) and production.
--
-- Production trace (addendum #4 — "extended only if genuinely missing"):
-- production's photo/instructions uploads happen client-side in
-- ProductionReadySection.tsx's UploadSection (kinds production_instructions
-- / do / completion) via a session-scoped `supabase.from('files').insert()`
-- — not a service-role route. `canUploadProduction` in that component is
-- true for the production role. Checked every files INSERT policy ever
-- created (0002, 0019, 0048 — none since 0019 touched the blanket policy):
--   - "files: sales and scheduler insert" (0002, recreated 0019) —
--     sales/scheduler/admin only.
--   - "files: installer uploads to assigned jobs" (0002) — role = installer,
--     assignment-scoped.
--   - "files: designers upload to assigned jobs" (0048) — role = designer,
--     assignment-scoped to job_designers.
-- None of these match role = 'production'. So a production user's client
-- insert into files is rejected by RLS today (no INSERT policy passes) —
-- production's photo-upload path is genuinely broken in production, not
-- just untested. Fixed here by adding production to this blanket policy,
-- matching production's blanket files SELECT above (production is an
-- office role viewing every job, not assignment-scoped like installer) and
-- matching how this same policy already treats sales/scheduler/admin
-- (blanket, no uploader_id check — the app sets uploader_id, RLS doesn't
-- enforce it here).
DROP POLICY IF EXISTS "files: sales and scheduler insert" ON files;
CREATE POLICY "files: sales and scheduler insert"
  ON files FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin', 'coordinator', 'production'));
