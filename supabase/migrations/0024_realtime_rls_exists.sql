-- 0024_realtime_rls_exists.sql
-- Replace the IN (SELECT ... UNION ...) pattern in the messages + files
-- realtime-compatible SELECT policies with EXISTS subqueries, which are
-- the standard Supabase RLS pattern and more reliably evaluated by the
-- Realtime engine. Split into two separate policies (role-based and
-- assignment-based) to keep each one simple.

-- ── messages ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages: select by role or assignment" ON messages;

CREATE POLICY "messages: select by role"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.role::text IN ('sales', 'scheduler', 'admin')
    )
  );

CREATE POLICY "messages: select by assignment"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN job_assignees ja ON ja.user_id = u.id
      WHERE u.auth_id = auth.uid()
        AND ja.job_id = messages.job_id
    )
  );

-- ── files ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "files: select by role or assignment" ON files;

CREATE POLICY "files: select by role"
  ON files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.role::text IN ('sales', 'scheduler', 'admin')
    )
  );

CREATE POLICY "files: select by assignment"
  ON files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN job_assignees ja ON ja.user_id = u.id
      WHERE u.auth_id = auth.uid()
        AND ja.job_id = files.job_id
    )
  );
