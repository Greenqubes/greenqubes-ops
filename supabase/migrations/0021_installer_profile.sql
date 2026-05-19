-- Add installer profile fields used by clash resolution substitute picker
alter table public.users
  add column if not exists years_experience integer,
  add column if not exists skills           text[] not null default '{}';
