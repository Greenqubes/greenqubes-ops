# Session 5 Notes — Schedule Feature (Read-Only)

> Read at the start of Session 6 alongside CONTEXT.md and plan.md.

_Done: 2026-05-02_

---

## What was built

The full schedule UI at `/schedule` — list, week, and month views, search, and filter chips. Read-only for now; job-detail editing is Session 6.

### Files created

| File | Purpose |
|---|---|
| `src/lib/supabase/queries/jobs.ts` | `getScheduleJobs()` server query + `ScheduleJob` type |
| `src/features/schedule/utils.ts` | Time/date helpers used across all views |
| `src/features/schedule/JobRow.tsx` | Single job card component |
| `src/features/schedule/ListView.tsx` | Date strip + job list for selected date |
| `src/features/schedule/WeekView.tsx` | 7-day view |
| `src/features/schedule/MonthView.tsx` | Calendar grid with drill-down |
| `src/features/schedule/ScheduleShell.tsx` | Client shell — owns all state |
| `src/app/schedule/page.tsx` | Server page — fetches data, passes to shell |

---

## Architecture

```
schedule/page.tsx  (server)
  → getScheduleJobs()  → Supabase (RLS filters automatically)
  → passes { jobs, lang } to ScheduleShell

ScheduleShell  (client)
  → owns: viewMode, filter, query, selectedDate
  → computes: filtered, dates, jobsByDate, weekDays, monthCells
  → renders: ListView | WeekView | MonthView

ListView / WeekView / MonthView  (no directive — pure render)
  → render JobRow components

JobRow  (no directive — pure render)
  → Link href="/jobs/[id]"  (404 until Session 6)
```

RLS handles access control — installer only sees their assigned jobs without any app-level role check. The query is identical for all roles.

---

## Key decisions

| Decision | Why |
|---|---|
| Query owns its own client | `SupabaseClient<Database>` generic from `@supabase/supabase-js` doesn't match the type returned by `@supabase/ssr`'s `createServerClient`. Simpler to let the query call `createClient()` internally. |
| `as unknown as ScheduleJob[]` cast | PostgREST nested select types aren't inferred by hand-written `Database` type. We define `ScheduleJob` explicitly and cast — safe because we control the query. |
| `maybeSingle() as { data: ProfileRow | null }` | Same pattern as `src/app/page.tsx` — avoids the generic inference issue with the Supabase client type. |
| `cn()` inlined in ListView/WeekView/MonthView | These files have no `'use client'` directive but are used inside client components. Inlining avoids an extra import and keeps them self-contained. Could be refactored to import from `@/lib/utils/cn` later — TypeScript allows it either way. |
| Jobs link to `/jobs/[id]` (not yet built) | Wires up the navigation now so Session 6 just needs to add the route. 404 until then. |
| Month → list drill-down | Clicking a date in month view sets `selectedDate` and switches `viewMode` to `'list'`. Same state, same component, no re-fetch. |

---

## `utils.ts` reference

```ts
toISO(d: Date): string                        // Date → 'YYYY-MM-DD'
fmtTime(t: string | null): string             // '14:30' → '2:30pm'
isOverdue(status, date): boolean              // scheduled + past date
getWeekDays(anchor: string): string[]         // 7 ISO dates from Sunday
getMonthCells(anchor: string): (string|null)[]// calendar grid (nulls = leading empty cells)
shiftDate(anchor, days): string               // move by ±N days
shiftMonth(anchor, delta): string             // move by ±N months (lands on 1st)
dayLabel(isoDate, locale): string             // 'Mon', '一', etc.
monthLabel(isoDate, locale): string           // 'May 2026', '2026年5月', etc.
langToLocale(lang): string                    // 'zh' → 'zh-CN', 'bn' → 'bn-BD'
```

---

## What's next — Session 6

`job-detail` — the big edit form:
- View + edit all job fields
- Assign/remove installers
- Upload attachments (links to R2 — placeholder until storage session)
- Financial fields (sales/scheduler only — installers see this section hidden)
- Status transitions (pending → awaiting_approval, approved → scheduled, etc.)
- Route: `/jobs/[id]`
- Data via `src/lib/supabase/queries/jobs.ts` (extend with `getJobById`)
- Form library: consider `react-hook-form` (use `Input`/`Select` forwardRef already wired)
