-- 0052_user_subrole_driver_qualifications.sql
-- (0051 is taken: feat-workflow-v3's 0051_job_projects.sql is already applied
-- to the shared DB even though that branch hasn't merged — same-number
-- migrations are silently skipped by db push, the 0015→0031 lesson.)
-- Provisioning overhaul (2026-09-03): subrole label, Driver flag, qualification
-- tags on users. Labels only — no permission impact; the 7-role model is untouched.
-- Also extends the 0044 privileged-column guard: these are admin-managed facts
-- (a user must not self-declare Driver or a license from the browser client).

alter table public.users add column if not exists subrole        text;
alter table public.users add column if not exists is_driver      boolean not null default false;
alter table public.users add column if not exists qualifications text[]  not null default '{}';

-- Full replacement of the 0044 function body with the three new columns added.
create or replace function public.guard_users_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server/service-role contexts (no end-user token) may change anything.
  if auth.uid() is null then
    return new;
  end if;

  -- Real admins acting through an authenticated session may change anything.
  if get_my_role() = 'admin' then
    return new;
  end if;

  -- Everyone else: privileged, admin/system-owned columns must not change.
  if new.role                 is distinct from old.role
     or new.auth_id           is distinct from old.auth_id
     or new.email             is distinct from old.email
     or new.deleted_at        is distinct from old.deleted_at
     or new.digest_subscriber is distinct from old.digest_subscriber
     or new.telegram_chat_id  is distinct from old.telegram_chat_id
     or new.subrole           is distinct from old.subrole
     or new.is_driver         is distinct from old.is_driver
     or new.qualifications    is distinct from old.qualifications
  then
    raise exception 'Not allowed to modify privileged user fields'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  return new;
end;
$$;
-- Trigger from 0044 already points at this function — no re-create needed.
