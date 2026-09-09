-- HR/Finance role (spec: docs/superpowers/specs/2026-09-04-hr-leave-design.md,
-- Nic 2026-09-04 — the explicitly-requested eighth role).
-- Must be a separate migration from any statement that USES the new value
-- (enum values added in a transaction are not visible within it — the
-- 0018/0019 and 0033/0034 split). Policies live in the companion migration.
--
-- Number claimed 2026-09-08 against the live DB (`supabase migration list`
-- highest remote = 0056) AND every branch on this machine and origin
-- (dev/main 0056, feat-hr-leave/feat-voice-pa 0053, feat-provision* 0052,
-- dev-bryan 0030). A same-number file is silently skipped by db push.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr';
