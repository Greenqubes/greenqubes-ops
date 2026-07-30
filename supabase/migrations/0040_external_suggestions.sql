-- 0040_external_suggestions.sql
-- Phase 4 smoke-test feedback (Nic, 2026-07-30): the external installers
-- bucket must be visible to EVERY office role, and sales may SUGGEST an
-- external contact — same amber-suggestion rules as internal installers.
-- Designer & production see everything but can change nothing.
--
-- A suggested link (is_suggestion = true) must NOT appear on the external
-- person's public link page until a scheduler/coordinator confirms it.
--
-- suggested_by is a PLAIN uuid on purpose — no FK to users. A second FK to
-- users broke every PostgREST embed once before (PGRST201, migration 0035).

ALTER TABLE job_external_contacts
  ADD COLUMN IF NOT EXISTS is_suggestion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suggested_by  uuid;

-- ── external_contacts: every office role may read the pool ───────────────────
CREATE POLICY "ext_contacts: office select"
  ON external_contacts FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'designer', 'production'));
-- (scheduler / coordinator / admin already have FOR ALL from 0039)

-- ── job_external_contacts: office read + sales suggestion rows ───────────────
CREATE POLICY "job_ext_contacts: office select"
  ON job_external_contacts FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'designer', 'production'));

-- Sales may create ONLY suggestion rows…
CREATE POLICY "job_ext_contacts: sales suggest"
  ON job_external_contacts FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'sales' AND is_suggestion = true);

-- …and remove ONLY suggestion rows (confirmed links are the schedulers').
CREATE POLICY "job_ext_contacts: sales remove suggestion"
  ON job_external_contacts FOR DELETE TO authenticated
  USING (get_my_role() = 'sales' AND is_suggestion = true);
