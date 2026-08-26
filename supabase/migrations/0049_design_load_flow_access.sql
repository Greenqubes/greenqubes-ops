-- 0049_design_load_flow_access.sql
-- Task 8 (Designer Load Flow): designers get FULL Files-tab access on their
-- jobs (uploads, URL links, buckets — identical to sales/scheduler/admin).
--
-- 0033/0034 widened jobs / job_assignees / job_coordinators SELECT to include
-- 'designer', but files was never widened — it was last touched in 0024,
-- before the designer role existed (0033). 0048 added a designer INSERT
-- policy on files, but with no matching SELECT policy the .insert().select()
-- pattern used throughout AttachmentBuckets.tsx returns nothing back to a
-- designer for their own upload, and the whole Files tab (including Task 6's
-- design_brief files) stays invisible to them. Same fix shape as 0024.
DROP POLICY IF EXISTS "files: select by role" ON files;

CREATE POLICY "files: select by role"
  ON files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.role::text IN ('sales', 'scheduler', 'admin', 'designer')
    )
  );

-- Protect the Designer JO bucket from rename/delete for EVERY role, at the
-- RLS layer, not just the UI (AttachmentBuckets.tsx already skips the
-- controls, but that's a bypassable client-side guard on its own). Renaming
-- goes straight through the session-scoped client
-- (`supabase.from('attachment_buckets').update(...)`), so this is the only
-- enforcement point for that path; 0025's original policies were
-- unconditional `using (true)`. Only blocks further updates/deletes once a
-- row's name ALREADY matches — a fresh "NEW BUCKET" can still be renamed TO
-- "DESIGNER JO" once, which then locks it. (The DELETE endpoint at
-- /api/buckets/[id] runs on the service client and bypasses RLS entirely, so
-- it carries its own matching guard in the route itself.)
DROP POLICY IF EXISTS "authenticated update attachment_buckets" ON public.attachment_buckets;
CREATE POLICY "authenticated update attachment_buckets"
  ON public.attachment_buckets FOR UPDATE
  TO authenticated
  USING (name !~* 'designer\s*jo');

DROP POLICY IF EXISTS "authenticated delete attachment_buckets" ON public.attachment_buckets;
CREATE POLICY "authenticated delete attachment_buckets"
  ON public.attachment_buckets FOR DELETE
  TO authenticated
  USING (name !~* 'designer\s*jo');
