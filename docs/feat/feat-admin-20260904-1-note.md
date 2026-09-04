---
session: feat-provision (provisioning overhaul → LIVE on production, launch day)
date: 2026-09-04
branch: feat-provision (worktree greenqubes-ops-provision-organisation, off origin/dev) → dev → main (fc9f13c) — production probed green; worktree removed, remote branch kept (stale duplicate `feat-provision-organisation` pending Nic's delete)
---

# Provisioning overhaul — card-only users, subroles, Driver, qualifications, Support crew

> Launch-eve/launch-day build. Installer provisioning couldn't happen before the
> demo, so name cards had to exist without accounts. Built in an isolated
> worktree while a parallel agent ran the guided tour on the dev tree.

## 1 — What shipped (all live)

- **Card-only users**: provision with name + role only (email input optional —
  "leave blank for a name card only"). Card appears in every assignment
  surface immediately; email attached later in Edit; the existing
  first-sign-in `auth_id` linking then works untouched. `email` was already
  nullable (0017 partial unique index) — only the API/form gates blocked it.
- **Migration 0052**: `users.subrole text`, `is_driver boolean default false`,
  `qualifications text[] default '{}'` + the 0044 privileged-column guard
  extended over all three (no self-declared Driver/licences from the browser).
- **Link-status dots** (Nic's artifact comments replaced text tags): red = no
  email, amber = email but never signed in, green = linked. Derived
  server-side (`link_status`) — raw email/auth_id never ship to card
  components. Shown on admin rows + installer/designer grids ONLY.
- **Card layout** (Nic's comments): Driver chip always right beside the name;
  subrole as a chip; qualifications chips on their own row; Insert-button tag
  inputs with × removal + datalist suggestions.
- **Admin Users**: role chips + subrole dropdown filter (incl. "No subrole"),
  "{n} of {m} users" count, Display-name + email editing (rename without
  delete-and-re-add — `updateUser` Pick extended; GreenqubesAI stays locked).
- **years_experience / skills**: removed from every screen and from
  `InstallerUser` / the clash Substitute payload; DB columns + AdminUser kept
  (drop ledgered in nic-checklist + Claude memory).
- **Support crew** (Nic: ONE merged bucket): `SubInstallerBucket` retitled
  "Support crew", pool = remaining installers + `getSupportUsers()` (every
  non-installer except GreenqubesAI). Rows keep `is_sub_installer = true` and
  the existing sub-installers / suggest-installer routes — both verified to
  accept any user id — so Supporting-Role Telegram, clash-check exclusion,
  FCFS-bar exclusion and workload counting were inherited for free. bn keeps
  its old "সাব-ইনস্টলার" label (freeze); exception pending Nic.
- New shared pieces: `src/lib/utils/user-meta.ts` (linkStatus / buildUserMeta /
  filterUsers / suggestions; own TDD suite) + `src/components/UserMetaLine.tsx`
  (LinkDot / DriverChip / chip rows).

## 2 — Incidents & facts worth keeping

- **Migration numbering across UNMERGED branches**: V3's `0051_job_projects.sql`
  was already applied to the shared DB though the branch isn't merged. A
  same-numbered migration is silently skipped by `db push` (the 0015→0031
  lesson). Renumbered to 0052; rule saved to memory: check
  `git ls-tree <branch> supabase/migrations/` on every active branch first.
- **`db push` from a fresh worktree**: needs `supabase/.temp/` copied from the
  linked checkout, AND fails with "remote migration not found locally" until
  the other branch's applied migration FILE exists locally — fixed by
  `git checkout feat-workflow-v3 -- supabase/migrations/0051_job_projects.sql`
  (never `migration repair`).
- **Vercel 63-char DNS limit**: `greenqubes-ops-git-feat-provision-organisation-
  greenqubes-projects` is 66 chars → the preview URL cannot exist (curl 000).
  Renamed the branch to `feat-provision`; Vercel then skipped rebuilding the
  identical SHA, so an empty commit forced the preview build. GitHub commit
  statuses (readable with the vault token) show Vercel build state + confirmed
  the original build had succeeded.
- **Probe format gotcha**: `curl -w "%{http_code} redirect=%{redirect_url}"`
  misreported 307/403 as 200 on this stack; full `-D -` header dumps are the
  trustworthy check.
- Merge with the tour work was conflict-free (own folder + separate i18n
  regions); main contributed only the checklist tick from the infra-perf
  session (it had pre-verified 0052 on the live DB). dev → main built as a
  synthetic merge (`merge-tree --write-tree` + `commit-tree`) since no local
  checkout of dev/main could be touched (parallel agents).

## 3 — Verification

Type-check green; **19 standalone suites green** (18 in the sweep + the tour's
`scripts.test.ts`); production build clean; production probes after deploy:
/login 200, /schedule 307 → /login, /api/admin/users 403, region `sin1::sin1`.

## ⚠️ Next session

- Nic: delete stale GitHub branch `feat-provision-organisation` (checklist).
- Drop `users.years_experience` + `skills` (checklist + memory).
- Bengali Support-crew label exception — Nic's call.
- V3 rounds 2–3 and the mobile-app backlog continue unchanged.
