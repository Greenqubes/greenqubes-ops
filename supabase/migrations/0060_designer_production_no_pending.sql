-- 0060 — designers and production stop seeing pending jobs
--
-- Nic, 2026-09-15. Found during a nav audit: designer and production had no
-- Pending tab, but 0034 let them SELECT every job including pending ones — so
-- the page worked perfectly if either typed the URL, showing them every draft
-- in the company. The screen and the database disagreed; Nic's call was to
-- make the database match the screen rather than the other way round.
--
-- Why that direction: a pending job is a half-written draft. Dates are
-- unconfirmed, details are missing, and some never happen. Production seeing
-- one could mean signage gets built for a job that changes or is cancelled.
-- The Pending tab was sales-only when it was first built, deliberately.
--
-- History of this policy, kept together so the next person does not have to
-- dig: 0002 (sales + scheduler) -> 0019 (+ admin) -> 0034 (+ designer,
-- coordinator, production). This migration takes designer and production back
-- out of the blanket grant and gives them their own status-scoped one, exactly
-- the shape 0058 already used for the hr role.
--
-- Coordinator deliberately STAYS on the blanket policy: coordinators create
-- jobs and save drafts of their own, so they need pending.
--
-- ⚠ Known consequence, checked against live data before applying: a designer
-- can be attached to a job while it is still pending (the New Job form offers
-- the designer picker), and the Design Load board shows everything that is not
-- completed. After this, such a job is invisible to that designer until it is
-- pushed to the schedule. At the time of writing there were 18 designer
-- assignments and none on a pending job, so nothing is affected today — but if
-- designers start being booked at creation, revisit this rather than wonder
-- where the job went.

DROP POLICY IF EXISTS "jobs: sales and scheduler see all" ON jobs;

-- Blanket, every status — the roles that create and schedule the work.
CREATE POLICY "jobs: sales and scheduler see all"
  ON jobs FOR SELECT TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'admin', 'coordinator'));

-- Craft roles: every job EXCEPT drafts.
CREATE POLICY "jobs: designer and production see non-pending"
  ON jobs FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('designer', 'production')
    AND status NOT IN ('pending', 'awaiting_approval')
  );
