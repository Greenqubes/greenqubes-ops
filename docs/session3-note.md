# Session 2 Notes — DB Schema, RLS, Auth

> Skim this at the start of Session 4 alongside CONTEXT.md and plan.md.
> Covers build plan Sessions 2 + 3 (done in one sitting, 2026-05-01).

---

## What was built

### Database (Supabase)
- 9 tables live: `users`, `jobs`, `job_financials`, `job_assignees`, `files`, `messages`, `asst_chats`, `kb_chunks`, `events`
- **`job_financials` is a new table not in the original spec** — commercial data (quote, supplier cost, margin) separated from `jobs` so RLS can block installers at the DB layer. Postgres RLS is row-level only, not column-level.
- Supabase CLI wired up: `npx supabase db push` applies migrations. No manual SQL pasting needed.
- pgvector columns use `extensions.vector(1024)` — must be schema-qualified on Supabase (not plain `vector`).
- Seed data applied: Sarah/sales, Kai/scheduler, Ravi+Ali/installers, 4 demo jobs across all statuses.

### RLS
- Two helper functions: `get_my_id()` and `get_my_role()` — both `SECURITY DEFINER` to avoid recursion when policies on other tables look up `public.users`.
- Installer completion updates intentionally have **no RLS policy** — they go through a server-side API route (service role) so the app layer can restrict which columns get written.
- `kb_chunks` and `events`: no write policy for `authenticated` role — service role only.

### Auth
- **Google OAuth**, not magic links. Team uses mix of `@greenqubes.com` and `@gmail.com` — no domain restriction.
- Login page: `src/app/(auth)/login/page.tsx` — single Google button.
- Callback route: `src/app/auth/callback/route.ts` — exchanges OAuth code for session, redirects to `/`.
- Middleware: unauthenticated → `/login`, authenticated on `/login` → `/`.
- Home page (`src/app/page.tsx`): server component, reads `public.users` by `auth_id`, shows name + role pill + sign out.

### Provisioning new users
When a new team member signs in with Google for the first time, they land on "Contact your administrator". To provision them, run in **Supabase SQL Editor**:
```sql
insert into users (auth_id, name, role, lang)
select id, 'Their Name', 'installer', 'en'
from auth.users
where email = 'their@email.com';
```
Replace name, role (`sales` / `scheduler` / `installer`), and email. Done — they can sign in immediately.

---

## Key decisions to remember

| Decision | Why |
|---|---|
| `job_financials` separate table | Only way to block installer access at DB layer |
| `extensions.vector(1024)` | Supabase installs pgvector in `extensions` schema |
| Google OAuth over magic links | Team preference, already on Google |
| No domain restriction on Google OAuth | Mix of @greenqubes.com and @gmail.com accounts |
| No installer UPDATE policy on `jobs` | Completion handled server-side to restrict columns |
| `get_my_role()` is SECURITY DEFINER | Prevents infinite RLS recursion on `users` table |

---

## Files added / changed this session

```
supabase/migrations/0001_schema.sql   — 9 tables + updated_at triggers
supabase/migrations/0002_rls.sql      — RLS policies + helper functions
supabase/migrations/0003_indexes.sql  — B-tree + GIN + IVFFlat indexes
supabase/seed.sql                     — demo users, jobs, messages
supabase/config.toml                  — Supabase CLI config (auto-generated)
src/lib/supabase/types.ts             — updated to match actual schema
src/lib/i18n/en.ts                    — added auth strings
src/lib/i18n/zh.ts                    — added Chinese auth strings
src/app/(auth)/login/page.tsx         — Google sign-in page
src/app/auth/callback/route.ts        — OAuth callback handler
src/app/page.tsx                      — home: profile card + sign out
src/components/SignOutButton.tsx      — client sign-out button
middleware.ts                         — auth redirect logic
```

---

## What's next — Session 4

Shared component library. Every feature will use these:
- `Card` — paper bg, 14px radius, 1px `--line` border
- `Pill` — status pills (scheduled/completed/etc.) + role pills
- `Btn` — primary (terracotta), secondary (border), ghost; lowercase weight-500
- `Field` + `Input` + `Select` — form primitives
- `Toast` — top-center, success / warning / error variants
- `Modal` — overlay + card

These go in `src/components/` and will be imported by every feature from Session 5 onward.
