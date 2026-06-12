-- 0034_workflow_v2_policies.sql
-- Workflow V2 Phase 1: widen RLS so designer / coordinator / production can
-- see jobs + assignees, and coordinator gains formal assignment rights.
-- Enum values were added in 0033 (separate transaction).

-- ── jobs ───────────────────────────────────────────────────────────────────
-- View access for all office roles. Installer keeps its own
-- "jobs: installer sees assigned only" policy from 0002 — unchanged.
DROP POLICY IF EXISTS "jobs: sales and scheduler see all" ON jobs;

CREATE POLICY "jobs: sales and scheduler see all"
  ON jobs FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin', 'designer', 'coordinator', 'production'));

-- ── job_assignees ──────────────────────────────────────────────────────────
-- All office roles can see who is assigned. Installer keeps its
-- "assignees: installer sees own rows" policy from 0002 — unchanged.
DROP POLICY IF EXISTS "assignees: sales and scheduler see all" ON job_assignees;

CREATE POLICY "assignees: sales and scheduler see all"
  ON job_assignees FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin', 'designer', 'coordinator', 'production'));

-- Coordinator gains formal assignment rights (insert/delete) alongside
-- sales / scheduler / admin.
DROP POLICY IF EXISTS "assignees: sales and scheduler insert" ON job_assignees;
DROP POLICY IF EXISTS "assignees: sales and scheduler delete" ON job_assignees;

CREATE POLICY "assignees: sales and scheduler insert"
  ON job_assignees FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin', 'coordinator'));

CREATE POLICY "assignees: sales and scheduler delete"
  ON job_assignees FOR DELETE TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin', 'coordinator'));

-- ── job_coordinators ───────────────────────────────────────────────────────
-- All office roles can read; scheduler / coordinator / admin manage rows.
-- Installer keeps its "coordinators_select_installer" policy from 0029.
DROP POLICY IF EXISTS "coordinators_select_sched_sales_admin" ON job_coordinators;
CREATE POLICY "coordinators_select_office_roles" ON job_coordinators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role IN ('sales', 'scheduler', 'admin', 'designer', 'coordinator', 'production')
    )
  );

DROP POLICY IF EXISTS "coordinators_insert_sched_sales_admin" ON job_coordinators;
CREATE POLICY "coordinators_insert_sched_coord_admin" ON job_coordinators
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role IN ('scheduler', 'coordinator', 'admin')
    )
  );

DROP POLICY IF EXISTS "coordinators_delete_sched_sales_admin" ON job_coordinators;
CREATE POLICY "coordinators_delete_sched_coord_admin" ON job_coordinators
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role IN ('scheduler', 'coordinator', 'admin')
    )
  );
