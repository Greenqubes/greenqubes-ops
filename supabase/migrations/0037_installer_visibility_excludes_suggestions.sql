-- 0037_installer_visibility_excludes_suggestions.sql
-- Workflow V2 Phase 2: installer suggestions.
--
-- A suggestion (job_assignees.is_suggestion = true) is a tentative installer
-- pick made by sales. It must NOT:
--   1. make the job appear on the suggested installer's dashboard, nor
--   2. be visible to the installer as a row about themselves,
-- until a coordinator/scheduler formally assigns them (is_suggestion = false).
--
-- Backward-compatible: dev/main code never sets is_suggestion = true (the column
-- defaults to false from migration 0033), so those deployments are unaffected.

-- ── jobs: assignment branch now counts formal assignments only ───────────────
DROP POLICY IF EXISTS "jobs: select by role or assignment" ON jobs;
CREATE POLICY "jobs: select by role or assignment"
  ON jobs FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT u.auth_id FROM users u
      WHERE u.role IN ('sales', 'scheduler')
      UNION
      SELECT u.auth_id FROM users u
      JOIN job_assignees ja ON ja.user_id = u.id
      WHERE ja.job_id = jobs.id
        AND ja.is_suggestion = false
    )
  );

-- ── job_assignees: installer sees only formal rows about themselves ──────────
DROP POLICY IF EXISTS "assignees: installer sees own rows" ON job_assignees;
CREATE POLICY "assignees: installer sees own rows"
  ON job_assignees FOR SELECT TO authenticated
  USING (
    get_my_role() = 'installer'
    AND user_id = get_my_id()
    AND is_suggestion = false
  );

-- ── jobs: coordinator + production may update ────────────────────────────────
-- Coordinator edits job details and manages installer assignment; production
-- marks production-ready / DO issued / edits production instructions. Which
-- columns each role may change is enforced in the job form UI; commercial data
-- lives in the separate job_financials table with its own policy, so this does
-- not widen access to quotes/costs/margins.
DROP POLICY IF EXISTS "jobs: coordinator and production can update" ON jobs;
CREATE POLICY "jobs: coordinator and production can update"
  ON jobs FOR UPDATE TO authenticated
  USING (get_my_role() IN ('coordinator', 'production'));
