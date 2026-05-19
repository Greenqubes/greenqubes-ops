-- 0023_realtime_rls_admin.sql
-- Migration 0019 added admin to get_my_role()-based SELECT policies on
-- messages and files, but get_my_role() silently returns null in the
-- Supabase Realtime engine's session (documented in 0008). Admin users
-- therefore never receive realtime events.
--
-- Fix: extend the auth.uid()-based policies (from 0008) to also include
-- admin, so Realtime can deliver events to admin users.

DROP POLICY IF EXISTS "messages: select by role or assignment" ON messages;
CREATE POLICY "messages: select by role or assignment"
  ON messages FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT u.auth_id FROM users u
      WHERE u.role IN ('sales', 'scheduler', 'admin')
      UNION
      SELECT u.auth_id FROM users u
      JOIN job_assignees ja ON ja.user_id = u.id
      WHERE ja.job_id = messages.job_id
    )
  );

DROP POLICY IF EXISTS "files: select by role or assignment" ON files;
CREATE POLICY "files: select by role or assignment"
  ON files FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT u.auth_id FROM users u
      WHERE u.role IN ('sales', 'scheduler', 'admin')
      UNION
      SELECT u.auth_id FROM users u
      JOIN job_assignees ja ON ja.user_id = u.id
      WHERE ja.job_id = files.job_id
    )
  );
