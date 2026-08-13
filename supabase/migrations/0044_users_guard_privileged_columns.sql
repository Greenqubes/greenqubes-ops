-- 0044_users_guard_privileged_columns.sql
-- SECURITY FIX (audit 2026-08-13, finding #1 — CRITICAL privilege escalation).
--
-- The "users: own record update only" policy (0002) lets a user update their own
-- row, but RLS is row-level, not column-level, so nothing stopped a user from
-- changing their OWN `role` — e.g. an installer flipping themselves to 'admin' or
-- 'scheduler' straight from the browser client. Admin became a pure DB role in
-- 0019, so that one column change grants the whole admin panel + scheduler-level
-- read of every job, all financials, and every user's private assistant chats.
--
-- RLS WITH CHECK can't compare NEW vs OLD, so column-level protection is enforced
-- with a BEFORE UPDATE trigger. Privileged columns may only change when:
--   • there is no end-user JWT (auth.uid() IS NULL) — i.e. the service-role client
--     used by the admin routes, the soft-delete path, and the auth callback; or
--   • the caller is a real admin acting through their own session.
-- Legitimate self-edits (lang, phone, name, visibility) are unaffected.

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
  if new.role             is distinct from old.role
     or new.auth_id           is distinct from old.auth_id
     or new.email             is distinct from old.email
     or new.deleted_at        is distinct from old.deleted_at
     or new.digest_subscriber is distinct from old.digest_subscriber
     or new.telegram_chat_id  is distinct from old.telegram_chat_id
  then
    raise exception 'Not allowed to modify privileged user fields'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  return new;
end;
$$;

drop trigger if exists users_guard_privileged_columns on public.users;

create trigger users_guard_privileged_columns
  before update on public.users
  for each row
  execute function public.guard_users_privileged_columns();
