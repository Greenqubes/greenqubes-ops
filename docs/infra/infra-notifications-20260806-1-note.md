# infra-notifications — Overdue Alert Scope + Schedule

_2026-08-06 · branch `dev` → `main` · live on production_

---

## What this session was about

Making the overdue job alerts actually usable. They were technically working, but firing on the wrong things at the wrong times.

---

## The problem, in plain terms

The overdue check looks for jobs still marked `scheduled` whose date has already passed, and Telegrams the sales person and installers on each one.

It had a **top** date limit (nothing in the future) but **no bottom limit**. So a job created months ago and never marked complete stayed "overdue" forever, and got re-alerted on every single run.

We only discovered this by running it manually against production: it sent **27 real Telegram alerts in one go**. Those weren't false alarms in the strict sense — they're genuinely jobs sitting in `scheduled` past their date — but almost all of them are jobs that were finished in real life and never closed out in the app.

Left alone with the every-2-hours schedule we'd briefly set, that was on track for roughly 300 messages a day to the team, around the clock. The team would have muted the bot within a week, which kills the whole point of the alert.

---

## What changed

### 1. Three-day lookback — `src/lib/supabase/queries/notifications.ts`

`getOverdueJobs` gained a lower date bound:

```ts
const OVERDUE_LOOKBACK_DAYS = 3

const cutoffSGT = new Date(sgtNow.getTime() - OVERDUE_LOOKBACK_DAYS * 86_400_000)
  .toISOString().slice(0, 10)

// ...
.eq('status', 'scheduled')
.lte('date', todaySGT)
.gte('date', cutoffSGT)   // ← new
```

Anything older than 3 days is treated as abandoned data rather than work to chase. An unresolved job now nags twice a day for 3 days, then goes quiet on its own.

### 2. Twice-daily schedule — `vercel.json`

Three iterations this session before it settled:

| | Cron | Meaning (SGT) |
|---|---|---|
| Started at | `0 0 * * *` | once daily, 8am |
| Then | `0 */2 * * *` | every 2 hours, round the clock |
| Then | `0 1-9/2 * * *` | every 2 hours, 9am–5pm |
| **Settled** | `0 1,10 * * *` | **9am and 6pm** |

Nic's call on the final one — "overdue jobs uncompleted should be just 9am and 6pm twice a day, this will suffice." Vercel schedules in UTC and SGT is UTC+8, hence `1,10` for 9am/6pm.

The 9am run is the morning reminder for anything hanging over; the 6pm run catches jobs that were meant to finish by end of day.

### 3. Comment corrected — `src/app/api/notifications/overdue/route.ts`

The header comment still claimed "every 2 hours" from an old schedule. Now reads twice daily 09:00/18:00 SGT.

---

## Correction worth recording

Early in the session I reported that `tplJobOverdue` in `src/lib/telegram/templates.ts` had a broken closing bold tag (`<\b>` instead of `</b>`) that would make Telegram reject the message. **That was wrong** — I misread search output. The tag was always correct, and the template sends fine. No fix was needed and none was made.

Flagging it here because a future session reading the git log or an older summary might otherwise go looking for a bug that never existed.

---

## Still on the table

- **The dedupe window is now redundant.** `wasRecentlyNotified` suppresses repeat alerts within 120 minutes. With runs 9 hours apart it never triggers from the cron any more. It still guards manual re-runs, so it was left alone — but if the schedule ever tightens again, that window is the thing to revisit.
- **The 6pm gap.** Jobs ending after 6pm won't be flagged until 9am the next day. Accepted as fine.
- **~27 jobs with wrong data.** Added to `nic-checklist.md` — finished jobs never moved off `scheduled`. Silenced by the cutoff but still wrong, and will distort the FCFS board and future reporting. Fold into the pre-go-live test-data wipe.

---

## How to test it manually

Doesn't wait for the cron. Sends **real** Telegram messages — not a dry run.

```powershell
$secret = "<CRON_SECRET from Vercel → Settings → Environment Variables>"
Invoke-RestMethod -Uri "https://greenqubes-ops.vercel.app/api/notifications/overdue" `
  -Headers @{ Authorization = "Bearer $secret" }
```

Returns `{ ok, sent, skipped }`. Run it twice in a row to check the dedupe logic without sending anything new — the second run should come back `sent: 0`.

---

## Housekeeping

- Session start was skipped this time (Nic went straight to `git pull`), so the usual plan/context/checklist read happened at session end instead.
- A parallel session pushed docs to `dev` mid-way through; rebased cleanly, no overlap.
- `npx tsc --noEmit` is clean on everything touched. It does report two **pre-existing, unrelated** errors — `Cannot find module 'next-themes'` in `ThemeProvider.tsx` and `UserMenu.tsx` — which just means local packages are stale. `npm install` clears it.

---

## Files touched

| File | Change |
|---|---|
| [vercel.json](../../vercel.json) | overdue cron → `0 1,10 * * *` |
| [src/lib/supabase/queries/notifications.ts](../../src/lib/supabase/queries/notifications.ts) | `OVERDUE_LOOKBACK_DAYS = 3` + `.gte('date', cutoffSGT)` |
| [src/app/api/notifications/overdue/route.ts](../../src/app/api/notifications/overdue/route.ts) | header comment |

**Commits:** `a451501`, `a458cf9`, `3fc7557` on `dev` → merged to `main` as `23e7086`.
