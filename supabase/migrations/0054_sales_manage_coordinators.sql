-- 0054_sales_manage_coordinators.sql
-- Sales can add and remove Sub POC / Coordinators again (Nic, 2026-09-07).
--
-- Regression introduced by 0034. 0029 originally granted INSERT and DELETE on
-- job_coordinators to ('sales','scheduler','admin'). The Workflow V2 policy
-- pass in 0034 dropped both and recreated them as
-- ('scheduler','coordinator','admin') -- sales lost the write side while
-- KEEPING its SELECT (0034's coordinators_select_office_roles). The job form
-- never agreed: JobDetailShell's canEditCore is
-- ['sales','scheduler','coordinator','admin'] and it leaves the coordinator
-- picker enabled for sales, so the UI offered an edit the database refused.
--
-- Symptom: a sales user editing any job and adding a coordinator got
-- "Save failed - try again" (the client-side insert runs .throwOnError()
-- inside performSave's single try block). Admin worked. Reproduced by Nic on
-- both desktop and mobile, across multiple jobs.
--
-- Also caused, silently: NewJobShell inserts coordinators WITHOUT checking the
-- result, so a sales-created job dropped its coordinators with no error shown
-- and still fired "you've been assigned" notifications at them. Removing the
-- policy gap fixes that path too; the unchecked insert is logged separately as
-- its own hardening item.
--
-- Scope: keeps the blanket-by-role shape the rest of this table already uses
-- (the scheduler/coordinator/admin rules are likewise not job-scoped), so this
-- restores 0029's intent rather than introducing a new access model. SELECT is
-- untouched, and no other table is affected.

DROP POLICY IF EXISTS "coordinators_insert_sched_coord_admin" ON job_coordinators;
CREATE POLICY "coordinators_insert_sales_sched_coord_admin" ON job_coordinators
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('sales', 'scheduler', 'coordinator', 'admin'));

DROP POLICY IF EXISTS "coordinators_delete_sched_coord_admin" ON job_coordinators;
CREATE POLICY "coordinators_delete_sales_sched_coord_admin" ON job_coordinators
  FOR DELETE TO authenticated
  USING (get_my_role() IN ('sales', 'scheduler', 'coordinator', 'admin'));
