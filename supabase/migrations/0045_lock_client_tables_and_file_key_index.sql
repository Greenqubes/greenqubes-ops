-- 0045_lock_client_tables_and_file_key_index.sql
-- SECURITY FIX (audit 2026-08-13).
--
-- Finding #2 (MEDIUM): clients + client_contacts were created in 0026 with
-- `using (true)` / `with check (true)` insert+delete policies, so ANY
-- authenticated user (installer included) could delete the whole client list
-- or insert junk. Restrict writes to the office roles that legitimately manage
-- clients (sales / scheduler / coordinator / admin). SELECT stays open to all
-- authenticated users — every role needs the company/POC dropdowns.
--
-- Finding #3 support: the r2/download-url route now looks a file up by its
-- r2_key before signing a URL. Add an index so that lookup is not a seq scan.

-- ── clients ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated insert clients" ON public.clients;
DROP POLICY IF EXISTS "authenticated delete clients" ON public.clients;

CREATE POLICY "clients: office roles insert"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'coordinator', 'admin'));

CREATE POLICY "clients: office roles delete"
  ON public.clients FOR DELETE TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'coordinator', 'admin'));

-- ── client_contacts ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated insert client_contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "authenticated delete client_contacts" ON public.client_contacts;

CREATE POLICY "client_contacts: office roles insert"
  ON public.client_contacts FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'coordinator', 'admin'));

CREATE POLICY "client_contacts: office roles delete"
  ON public.client_contacts FOR DELETE TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'coordinator', 'admin'));

-- ── files r2_key lookup index (for the download-url authorization check) ─────
CREATE INDEX IF NOT EXISTS files_r2_key_idx ON public.files (r2_key);
