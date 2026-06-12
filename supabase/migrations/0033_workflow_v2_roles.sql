-- 0033_workflow_v2_roles.sql
-- Workflow V2 Phase 1: new role enum values + installer suggestion columns.
-- Policies that reference the new values live in 0034 — enum values added
-- here cannot be used in the same transaction (same split as 0018/0019).

-- ── New role enum values ────────────────────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'designer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'coordinator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'production';

-- ── Installer suggestion + sub-installer columns on job_assignees ──────────
ALTER TABLE job_assignees
  ADD COLUMN IF NOT EXISTS is_suggestion    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suggested_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_sub_installer boolean NOT NULL DEFAULT false;
