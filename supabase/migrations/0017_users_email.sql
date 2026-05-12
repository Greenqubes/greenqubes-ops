-- Add email to users for pre-provisioning (auth_id can be null until first sign-in)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email text;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON public.users (email)
  WHERE email IS NOT NULL;
