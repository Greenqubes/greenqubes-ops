-- 0019_admin_role_policies.sql
-- Seeds ai@greenqubes.com as admin.
-- Drops and recreates all RLS policies that referenced 'scheduler' or
-- ('sales', 'scheduler') to also include 'admin'.
-- Policies not listed here are unchanged (installer-specific, user-id-based,
-- or already open to all authenticated).

-- ── Seed ───────────────────────────────────────────────────────────────────
UPDATE public.users
SET role = 'admin'
WHERE email = 'ai@greenqubes.com';

-- ── jobs ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "jobs: sales and scheduler see all"     ON jobs;
DROP POLICY IF EXISTS "jobs: sales and scheduler can insert"  ON jobs;
DROP POLICY IF EXISTS "jobs: scheduler can update any"        ON jobs;
DROP POLICY IF EXISTS "jobs: scheduler can delete"            ON jobs;

CREATE POLICY "jobs: sales and scheduler see all"
  ON jobs FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "jobs: sales and scheduler can insert"
  ON jobs FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "jobs: scheduler can update any"
  ON jobs FOR UPDATE TO authenticated
  USING (get_my_role() IN ('scheduler', 'admin'));

CREATE POLICY "jobs: scheduler can delete"
  ON jobs FOR DELETE TO authenticated
  USING (get_my_role() IN ('scheduler', 'admin'));

-- ── job_financials ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "financials: sales and scheduler select" ON job_financials;
DROP POLICY IF EXISTS "financials: sales and scheduler insert" ON job_financials;
DROP POLICY IF EXISTS "financials: sales and scheduler update" ON job_financials;

CREATE POLICY "financials: sales and scheduler select"
  ON job_financials FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "financials: sales and scheduler insert"
  ON job_financials FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "financials: sales and scheduler update"
  ON job_financials FOR UPDATE TO authenticated
  USING  (get_my_role() IN ('sales', 'scheduler', 'admin'))
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin'));

-- ── job_assignees ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "assignees: sales and scheduler see all" ON job_assignees;
DROP POLICY IF EXISTS "assignees: sales and scheduler insert"  ON job_assignees;
DROP POLICY IF EXISTS "assignees: sales and scheduler delete"  ON job_assignees;

CREATE POLICY "assignees: sales and scheduler see all"
  ON job_assignees FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "assignees: sales and scheduler insert"
  ON job_assignees FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "assignees: sales and scheduler delete"
  ON job_assignees FOR DELETE TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin'));

-- ── files ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "files: sales and scheduler see all"    ON files;
DROP POLICY IF EXISTS "files: sales and scheduler insert"     ON files;

CREATE POLICY "files: sales and scheduler see all"
  ON files FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "files: sales and scheduler insert"
  ON files FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'admin'));

-- ── messages ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages: sales and scheduler see all" ON messages;
DROP POLICY IF EXISTS "messages: sales and scheduler post"    ON messages;

CREATE POLICY "messages: sales and scheduler see all"
  ON messages FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin'));

CREATE POLICY "messages: sales and scheduler post"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('sales', 'scheduler', 'admin') AND
    author_id = get_my_id()
  );

-- ── asst_chats ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "asst_chats: scheduler reads all" ON asst_chats;

CREATE POLICY "asst_chats: scheduler reads all"
  ON asst_chats FOR SELECT TO authenticated
  USING (get_my_role() IN ('scheduler', 'admin'));

-- ── kb_chunks ──────────────────────────────────────────────────────────────
-- Admin bypass: admin sees all chunks regardless of visibility tokens.
DROP POLICY IF EXISTS "kb_chunks: visibility token check" ON kb_chunks;

CREATE POLICY "kb_chunks: visibility token check"
  ON kb_chunks FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin' OR
    'public-internal'                 = ANY(visibility) OR
    ('role:' || get_my_role())        = ANY(visibility) OR
    ('private:' || get_my_id()::text) = ANY(visibility)
  );

-- ── events ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events: scheduler can read" ON events;

CREATE POLICY "events: scheduler can read"
  ON events FOR SELECT TO authenticated
  USING (get_my_role() IN ('scheduler', 'admin'));
