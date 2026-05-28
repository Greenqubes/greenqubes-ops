-- Add soft delete support to users table for departed employees
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
