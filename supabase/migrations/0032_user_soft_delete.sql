-- Add soft delete support to users table for departed employees
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

create index if not exists users_active_idx on public.users (id)
  where deleted_at is null;
