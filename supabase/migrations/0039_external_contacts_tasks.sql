-- 0039_external_contacts_tasks.sql
-- Workflow V2 Phase 4: external installer persistent links + job task list.
-- (Plan Task 20 numbered this 0034; migrations 0034-0038 landed first.)
--
-- external_contacts: one row per external person. The token IS their identity —
-- no login, no password, never expires. deleted_at soft-deletes (invalidates
-- the link immediately); clearing it restores the SAME token with all job
-- history intact.
--
-- Backward-compatible: dev/main code never touches these tables, and the
-- file_kind value added at the bottom is unused until Phase 4 ships.

-- ── 1. External contacts ─────────────────────────────────────────────────────
-- Token default uses built-in gen_random_uuid() (strong RNG, no pgcrypto —
-- that extension is not enabled on this DB and gen_random_bytes broke db push):
-- a dash-stripped UUID = 32 hex chars, 122 bits of entropy. Unguessable.
CREATE TABLE external_contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  phone      text NOT NULL DEFAULT '',
  token      text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX external_contacts_token_idx ON external_contacts(token);

ALTER TABLE external_contacts ENABLE ROW LEVEL SECURITY;

-- Scheduler / coordinator / admin manage contacts. The public /ext page never
-- reads through RLS — it uses the service-role client after validating the token.
CREATE POLICY "ext_contacts: sched coord admin all"
  ON external_contacts FOR ALL TO authenticated
  USING (get_my_role() IN ('scheduler', 'coordinator', 'admin'));

-- ── 2. Job ↔ external contact join ───────────────────────────────────────────
CREATE TABLE job_external_contacts (
  job_id      uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES external_contacts(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'declined')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, contact_id)
);

CREATE INDEX job_external_contacts_job_idx     ON job_external_contacts(job_id);
CREATE INDEX job_external_contacts_contact_idx ON job_external_contacts(contact_id);

ALTER TABLE job_external_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_ext_contacts: sched coord admin all"
  ON job_external_contacts FOR ALL TO authenticated
  USING (get_my_role() IN ('scheduler', 'coordinator', 'admin'));

-- ── 3. Job task list ─────────────────────────────────────────────────────────
CREATE TABLE job_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  text         text NOT NULL,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_tasks_job_idx ON job_tasks(job_id);

ALTER TABLE job_tasks ENABLE ROW LEVEL SECURITY;

-- Office roles read every job's tasks.
CREATE POLICY "tasks: office select"
  ON job_tasks FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'coordinator', 'admin', 'designer', 'production'));

-- Installers read tasks only on jobs they are FORMALLY assigned to
-- (suggestions must not leak the job — same rule as migration 0037).
CREATE POLICY "tasks: installer select assigned"
  ON job_tasks FOR SELECT TO authenticated
  USING (
    get_my_role() = 'installer'
    AND EXISTS (
      SELECT 1 FROM job_assignees ja
      WHERE ja.job_id = job_tasks.job_id
        AND ja.user_id = get_my_id()
        AND ja.is_suggestion = false
    )
  );

-- Sales / scheduler / coordinator / admin add, edit, reorder, delete.
CREATE POLICY "tasks: office insert"
  ON job_tasks FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'coordinator', 'admin'));

CREATE POLICY "tasks: office update"
  ON job_tasks FOR UPDATE TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'coordinator', 'admin'));

CREATE POLICY "tasks: office delete"
  ON job_tasks FOR DELETE TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'coordinator', 'admin'));

-- Installers tick off tasks — but only on jobs they are formally assigned to.
CREATE POLICY "tasks: installer tick assigned"
  ON job_tasks FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'installer'
    AND EXISTS (
      SELECT 1 FROM job_assignees ja
      WHERE ja.job_id = job_tasks.job_id
        AND ja.user_id = get_my_id()
        AND ja.is_suggestion = false
    )
  );

-- ── 4. file_kind: external verification uploads (future use) ─────────────────
ALTER TYPE file_kind ADD VALUE IF NOT EXISTS 'external_verification';
