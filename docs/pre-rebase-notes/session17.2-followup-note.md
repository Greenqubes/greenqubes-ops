# Session 17.2 (follow-up) — Diagnostics + Vercel auto-deploy

_Done: 2026-05-05_

---

## What this session did

Session 17.2 ended with both bugs marked "not confirmed" and a checklist of things to diagnose. This session ran those diagnostics, found the root cause, and closed everything out.

---

## Diagnostics run

| Check | Result |
|---|---|
| `toISO()` fix in code (`utils.ts`) | ✓ local date components — fix was correct |
| Realtime subscription in `ScheduleShell.tsx` | ✓ `router.refresh()` on all job events — fix was correct |
| Migration 0010 applied to Supabase (local + remote) | ✓ both show 0010 |
| `jobs` in `supabase_realtime` publication | ✓ confirmed via live DB query (`pg_publication_tables`) |
| Jobs SELECT RLS policy | ✓ `auth.uid()` subquery, no SECURITY DEFINER |
| Latest commits on GitHub (`origin/main`) | ✓ up to date |
| Vercel production build timestamp | ✗ **22:46 SGT May 4 — 85 minutes before the 17.2 commit (00:11 SGT May 5)** |

---

## Root cause

All code and DB fixes from Session 17.2 were correct. The reason nothing was confirmed: **Vercel never deployed them.**

The Vercel project was created via `npx vercel --prod` (CLI), not via the GitHub integration. Auto-deploy from GitHub was never connected. Every commit after the initial setup pushed to GitHub but Vercel ignored it — deployments were only triggered by manual CLI runs.

---

## What was fixed

**Calendar navigation** — confirmed working by Nic in browser after manual deploy.

**Live schedule** — DB side was already ready (migration 0010 applied, `jobs` in realtime publication, RLS policy using `auth.uid()`). Code side deployed with the manual deploy. Not yet explicitly confirmed in-browser but all infrastructure is correct.

**Vercel → GitHub auto-deploy** — connected via Vercel dashboard (Settings → Git → Connect Repository → `Greenqubes/greenqubes-ops`, branch `main`). Verified: a test push (`8290190`) triggered a new Vercel build within seconds of hitting GitHub.

---

## Files changed this session

- `docs/session17.2-note.md` — updated Status section from "still broken" to "complete ✓"
- `docs/plan.md` — updated Session 17.2 entry to ✓; updated migration checklist
- `docs/CONTEXT.md` — updated migration checklist
- `docs/session17.2-followup-note.md` — this file

---

## Going into Session 18

- Session 17.2 is fully closed ✓
- Vercel auto-deploys on every push to `main` — no more manual `npx vercel --prod`
- Live schedule (router.refresh on job changes) is deployed but not browser-confirmed — worth a quick smoke test at the start of Session 18 or during the design review
- Session 18 is the full visual design review against `docs/greenqubes-phase0.jsx` — all screens, all roles
