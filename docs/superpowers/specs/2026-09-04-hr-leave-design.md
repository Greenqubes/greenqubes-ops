# HR / Finance Role + Leave Tracking + Public Holidays — Design Spec

**Date:** 2026-09-04 · **Status:** Approved design, awaiting Nic's spec review
**Branch:** `feat-hr-leave` (worktree `c:\Greenqubes_GitHub\greenqubes-ops-hr-leave`, off `dev` — includes the provisioning overhaul + guided tour)
**Migration:** 0053 (0052 is taken by the provisioning overhaul, applied to the shared DB)

## Why

Nic's HR person (who also handles finance) needs to record who is on leave, from when to
when, and the whole team needs to see it where scheduling happens. She also needs to see
every job's prices. Decided in the 2026-09-04 brainstorm; the eighth role was explicitly
requested by Nic, satisfying the CLAUDE.md roles rule.

## Decisions (Nic, 2026-09-04)

1. Leave is treated **like a clash** — red, in the clash modal / FCFS / edit checks, same as a double-booking.
2. Leave covers the **whole team** (every internal user, any role). External contacts excluded.
3. Visible on: **schedule views** (built NOW on the current pages — Nic's call to bypass waiting for V3), **installer pickers + FCFS**, plus **bell/Telegram on new leave**. No dedicated everyone-facing leave calendar page.
4. HR manages leave from an **HR-only Leave tab** (HR + admin see it).
5. HR role access: **schedule view-only + read-only job form + assistant** — plus **view of all prices** (she is also the finance role). View only; sales keeps entering prices.
6. Granularity: **full days + AM/PM half days** at either end of a range.
7. Leave entries carry a **type** (annual / medical / emergency / other) + optional note — **visible to HR + admin only**, enforced by the database. Everyone else sees just "On leave".
8. Build approach: **one clash engine** — leave becomes a second conflict kind inside the existing clash logic; every consumer inherits it.
9. **Public holidays: in scope** — Singapore public holidays, label-only (no scheduling warning), maintained yearly by HR in our own table. No external service.
10. Timing: build now off `dev`; V3 continues in its own worktree.

## 1. The HR role

- New `user_role` enum value **`hr`**. UI label **"HR / Finance"** (en + zh; bn frozen, falls back).
- Provisioned from Admin → Users like any role (inherits the 0052 card layout; subrole/driver/qualification fields don't apply to `hr`).
- **Can see:** the schedule (all non-pending jobs, view-only), the job form read-only — details, team, files, **and the financials card** — the Leave tab, and the AI assistant.
- **Cannot:** create/edit/delete jobs, post in job chat (not a chat participant or notification recipient), see the FCFS board (`/fcfs` bounces to `/schedule`, same pattern as installers), access Admin, or see pending jobs (today's pending visibility rules simply don't include `hr`; V3's pending-is-personal keeps it that way).
- **RLS changes:** `hr` gets a `jobs` SELECT policy scoped to **non-pending statuses only** (read-only — no UPDATE/INSERT, never `pending`/`awaiting_approval`), plus read access to the `files` read policies the job form needs, and to `job_financials` **SELECT only** (currently sales + scheduler + admin; insert/update unchanged).
- Admin "Preview as" gains HR. The guided tour gets a small HR variant (Schedule → Leave tab → assistant).
- **Standing rule unchanged:** money figures never reach the AI assistant for anyone. Her screens show prices; her assistant does not.

## 2. Data model (migration 0053 — additive, deploy-safe)

```
user_leaves         — id, user_id → users, date_start, date_end,
                      start_portion ('full'|'am'|'pm'), end_portion ('full'|'am'|'pm'),
                      created_by, created_at, updated_at
user_leave_details  — leave_id → user_leaves (cascade), leave_type
                      ('annual'|'medical'|'emergency'|'other'), note
public_holidays     — id, holiday_date, name
```

- `user_leaves`: SELECT for all authenticated users (schedule display + clash checks need it); INSERT/UPDATE/DELETE for `hr` + `admin` only.
- `user_leave_details`: **all operations `hr` + `admin` only** — the privacy split lives at the DB layer, not in the UI. A leave row is complete without its details row.
- `public_holidays`: SELECT for all authenticated; writes `hr` + `admin`. Seeded at build time from MOM's gazetted Singapore list for 2026 (+ 2027 when available) — **Nic/HR verify the seeded dates on the preview**; HR adds each new year when gazetted (~11 rows/year).
- Half-day semantics: `start_portion='pm'` = first day only the afternoon is leave; `end_portion='am'` = last day only the morning. Single-day half leave: `date_start = date_end` with the matching portion on both.
- `user_leaves` + `public_holidays` added to the realtime publication so open schedule/FCFS pages update live (the `useLiveChannel` pattern).
- Purely additive — deployed dev/main code is unaffected. **`npx supabase db push` runs BEFORE the code deploys** (standing rule), with Nic's explicit OK.

## 3. The Leave tab

- New route `/leave`; nav tab for `hr` + `admin` only (BottomNav on desktop, hamburger drawer on phones). Other roles never see the tab; direct visits bounce to `/schedule`.
- Two sections:
  - **Leave** — upcoming entries first, past below. Each row: person, date range with AM/PM marks, type, note, edit/delete (confirm on delete). **Add** opens a form: person picker (active internal users, all roles), from/to dates, AM/PM toggles per end, type, optional note. Saving leave that overlaps the same person's existing leave warns first (duplicate guard).
  - **Public holidays** — list by year, add/edit/delete (date + name).
- Overlays follow the hard rule: above BottomNav, `z-[60]`+.

## 4. Clash engine — leave as a second conflict kind

- `src/lib/utils/clash-detection.ts` (home of `timesOverlap`) learns leave: conflict results carry a kind — **booking** (existing) or **leave** — so labels can differ while severity matches (leave = red/hard).
- Half-day aware: a job's actual `time_start`/`time_end` is compared against the on-leave portion of each day; the AM/PM boundary matches the FCFS board's existing AM/PM convention (exact hour pinned at plan time from that code). Multi-day jobs conflict if any day overlaps.
- Consumers inherit automatically: push-to-schedule clash check, edit-clash (`checkOnly`), assign-installers, the clash modal (new "On leave" label), FCFS bars + clash chips + drawer, sales suggestion flow, and the assistant's `check_clashes` tool.
- **Support crew / sub-installers DO get the leave check** (they're excluded from booking clashes, but a person on leave is away regardless of role on the job). Externals: no leave, no change.
- Designer due dates do **not** warn on leave (future item if wanted).

## 5. Visibility surfaces (built now, on the current schedule pages)

- **Schedule list view:** a compact "On leave: {names}" line on each affected day, and the public holiday name on its day. Week/month views: minimal markers (exact rendering settled at plan/mockup time).
- **Hydration rules apply** (the /schedule #418 lesson): no `toLocale*` in render paths, localStorage only in mount effects, static English date labels.
- **Installer pickers** (job form grid, assignment panel): "On leave" badge (grey/red-tinted) on anyone away for the job's date(s), alongside the existing suggested/assigned states.
- **FCFS board:** leave marked on the person's bar + surfaced in the clash drawer.
- ⚠️ **V3 interplay (accepted by Nic):** V3 round 2 rebuilds the schedule list. When V3 merges, the leave/holiday lines must be **re-carried** into the new list layout, and V3's pending-visibility migration (now 0054+) must include `hr` in its rewritten `jobs` SELECT policies. Both flagged in the V3 round-2 plan.

## 6. Notifications

- Every new leave entry → **bell card to schedulers** ("{name} — on leave {dates}"). No Telegram for plain entries (noise control).
- If the leave overlaps a scheduled job where the person is **formally assigned** → escalate: **bell + Telegram** to the scheduler and each affected job's person-in-charge + coordinators, with the job linked ("New leave clashes with {job}").
- Leave **type never appears** in any notification — just "on leave".
- Editing leave re-runs the overlap check on the new range; deleting/shortening is quiet (Nic's quiet-undo precedent).
- Telegram templates follow existing patterns in `src/lib/telegram/`; new strings en + zh.

## 7. Testing

- Standalone `npx tsx` suites (repo pattern): half-day × job-time overlap math; conflict-kind merging; leave/holiday route permission rules (writes hr/admin only, details never returned to other roles); notification recipient selection.
- Nic's smoke checklist: HR login journey (nav, read-only form, prices visible); privacy check from a non-HR login (type/note absent from screens AND network responses); red "On leave" clash on push / edit / FCFS / suggestion; half-day pass case (AM leave, afternoon job); holiday label on schedule; bell + Telegram arrivals; assistant "can X take a job on Y?" answer.

## 8. Out of scope — noted for future development

- **Leave balances + entitlement counting** (days remaining per person/year) — future session.
- **Self-service leave requests/approval flow** (staff request → HR approves) — future session.
- Leave for external contacts; designer due-date leave warnings; public-holiday scheduling warnings; leave shading in the team workload chart.
- Schedule-list re-carry after V3 merges is follow-up work, not scope creep here.
