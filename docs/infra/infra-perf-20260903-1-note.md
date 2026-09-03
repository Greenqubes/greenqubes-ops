---
session: infra-perf (page navigation speed → LIVE on production)
date: 2026-09-03
branch: perf-page-speed → dev (ef292ad) → main (70668f3) — production probed sin1::sin1; branch + worktree deleted after merge (Nic — no archive)
---

# Page navigation speed — Singapore region + instant loading skeletons

> Nic: pages take "a few seconds" between clicks — is it the old hydration bug?
> No — the app's server was in the wrong hemisphere, and no page had a loading state.

## 1 — Diagnosis (probes, not guesses)

- Supabase from this PC (Singapore): connect ~20ms, TTFB ~70ms → the database is in Singapore.
- Production header: `X-Vercel-Id: sin1::iad1::…` → requests enter Vercel's **Singapore edge** but are **served from iad1 (US East)** — Vercel's default function region, never configured since day one.
- Per navigation, sequential round trips (each ~230ms US↔SG): middleware `getUser()` + `users.deleted_at` check; then the page's `getUser()` again + profile (role/lang) + the main jobs query + the follow-up sales-names query (the "never embed users on jobs" rule) = **5–6 trips ≈ 1.2–1.5s** server time, plus the browser↔US legs and Hobby-plan cold starts → the observed 2–3s.
- **Zero `loading.tsx` in the whole app** → a tap gave no feedback until the full server render returned; the old page just froze.
- **Hydration #418 ruled out** — a client-side re-render nuisance on /schedule after load; adds no navigation latency. Untouched, per the standing CLAUDE.md rule.

## 2 — Fix 1: `"regions": ["sin1"]` in vercel.json

One line. Pins all serverless functions to Singapore, next to both the users and Supabase; each DB round trip drops from ~230ms to single-digit ms. Applies to previews AND production, so it was verifiable before any merge. Hobby plan allows exactly one function region — sin1 is it. (Middleware already ran on the SG edge; only page/API functions moved.)

## 3 — Fix 2: instant loading skeletons

New shared `src/components/PageSkeleton.tsx` mirrors the app frame so a tap paints immediately: CompanyBar-shaped top bar (mobile hamburger / centered logo / bell + desktop logo-left, matching the real bar's variants), pulsing card list, BottomNav placeholder. Two variants: `tabs` (pages that render BottomNav) and `detail` (job forms, admin, assistant). `loading.tsx` added on 10 routes: schedule, pending, completed, fcfs, design-load, installer, assistant, admin, jobs/[id], jobs/new. Side benefit: Next.js serves the skeleton instantly on prefetched links, so transitions start the moment of the tap.

## 4 — Verification

- Branch preview (probed with the Vercel bypass secret): `sin1::sin1`; /login TTFB **0.09–0.14s** vs production's **0.31–0.40s** pre-fix.
- Nic on the preview, then the dev preview: approved ("very fast now").
- Production after the `main` push: `sin1::sin1`, ~0.1s warm.
- Type-check + production build green before commit.

## 5 — Logistics

- Built on temp branch `perf-page-speed` off `dev` in an isolated worktree — Nic's dev folder hosts the guided-tour agent and was never touched; the tour's two docs commits rode along into `main` with this merge.
- Rebased over the tour agent's dev commits → pushed to `dev` (fast-forward) → conventional merge commit to `main` (70668f3), merged tree byte-identical to dev.
- Per Nic's instruction: branch + worktree **deleted** after the merge — not kept for archive (unlike V2/V3 branches).

## Residue / future

- The **first** tap after the app sits idle still pays a Hobby-plan cold start (~1s); every tap after is fast. A paid Vercel plan removes it if it ever bothers the team.
- Optional follow-up (not built): trim the query waterfall — the page re-runs `getUser()` right after middleware already did, and profile + jobs could run in parallel. Only worth measuring now that the region fix has landed.
