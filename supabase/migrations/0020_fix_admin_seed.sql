-- 0020_fix_admin_seed.sql
-- Migration 0019 seeded admin via public.users.email, but that column is only
-- populated on first sign-in after migration 0017. For users who signed in
-- earlier the column is NULL. This migration joins through auth.users instead.

UPDATE public.users pu
SET    role = 'admin'
FROM   auth.users au
WHERE  pu.auth_id = au.id
AND    au.email   = 'ai@greenqubes.com';
