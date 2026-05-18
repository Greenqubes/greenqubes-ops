# Pre-Send Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scheduler name banner and a "busier than usual" warning to the existing WorkloadPreviewModal that appears when sales submits a job for approval.

**Architecture:** All changes live in one file (`WorkloadPreviewModal.tsx`) plus three i18n files. The modal fetches scheduler names on mount (same Supabase client pattern already used for workload). The busy warning is derived from already-fetched workload data — no new API calls. Two new i18n keys cover the new UI copy.

**Tech Stack:** Next.js 15, React, Supabase JS client, Tailwind CSS, TypeScript strict

---

## File map

| Action | File |
|--------|------|
| Modify | `src/features/approvals/WorkloadPreviewModal.tsx` |
| Modify | `src/lib/i18n/en.ts` |
| Modify | `src/lib/i18n/zh.ts` |
| Modify | `src/lib/i18n/bn.ts` |

---

## Task 1: Add i18n keys

**Files:**
- Modify: `src/lib/i18n/en.ts` — after `workloadSelectPrompt` line (line 81)
- Modify: `src/lib/i18n/zh.ts` — after `workloadSelectPrompt` line (line 80)
- Modify: `src/lib/i18n/bn.ts` — after `workloadSelectPrompt` line (line 73)

- [ ] **Step 1: Add keys to en.ts**

Find the line `workloadSelectPrompt: 'Tap a date to reschedule (optional)',` in `src/lib/i18n/en.ts` and add the two new keys immediately after it:

```ts
  workloadSelectPrompt: 'Tap a date to reschedule (optional)',
  workloadSendingTo: 'Sending to scheduler',
  workloadBusyWarning: 'jobs already on this day — busier than usual',
```

- [ ] **Step 2: Add keys to zh.ts**

Find `workloadSelectPrompt: '点击日期可更改（可选）',` in `src/lib/i18n/zh.ts` and add after it:

```ts
  workloadSelectPrompt: '点击日期可更改（可选）',
  workloadSendingTo: '发送给排班员',
  workloadBusyWarning: '个工作已在此日期 — 比平时繁忙',
```

- [ ] **Step 3: Add keys to bn.ts**

Find `workloadSelectPrompt: 'তারিখ পরিবর্তন করতে ট্যাপ করুন (ঐচ্ছিক)',` in `src/lib/i18n/bn.ts` and add after it:

```ts
  workloadSelectPrompt: 'তারিখ পরিবর্তন করতে ট্যাপ করুন (ঐচ্ছিক)',
  workloadSendingTo: 'শিডিউলারকে পাঠানো হচ্ছে',
  workloadBusyWarning: 'টি কাজ ইতিমধ্যে এই দিনে — স্বাভাবিকের চেয়ে ব্যস্ত',
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/zh.ts src/lib/i18n/bn.ts
git commit -m "feat: add workloadSendingTo + workloadBusyWarning i18n keys"
```

---

## Task 2: Update WorkloadPreviewModal

**Files:**
- Modify: `src/features/approvals/WorkloadPreviewModal.tsx`

- [ ] **Step 1: Add BUSY_THRESHOLD constant and getInitials helper**

Add these two items right after the existing `DAY_LABELS` const (currently line 21):

```ts
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const BUSY_THRESHOLD = 5

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
}
```

- [ ] **Step 2: Add schedulerNames state**

Inside the `WorkloadPreviewModal` function body, add a new state line after the existing `saving` state (currently line 55):

```ts
  const [saving,          setSaving]          = useState(false)
  const [schedulerNames,  setSchedulerNames]  = useState<string[]>([])
```

- [ ] **Step 3: Add scheduler fetch effect**

Add a new `useEffect` immediately after the existing workload `useEffect` (currently lines 100–102). The new effect has an empty dependency array so it runs once on mount:

```ts
  useEffect(() => {
    fetchWorkload(weekStart, weekEnd)
  }, [weekStart, weekEnd, fetchWorkload])

  useEffect(() => {
    async function fetchSchedulers() {
      const supabase = createClient()
      const { data } = await supabase
        .from('users')
        .select('name')
        .eq('role', 'scheduler')
      setSchedulerNames((data ?? []).map((u: { name: string }) => u.name))
    }
    fetchSchedulers()
  }, [])
```

- [ ] **Step 4: Derive selectedDayCount**

Add a derived constant immediately before the `return` statement (currently line 115), after the `today` const:

```ts
  const today = new Date().toISOString().slice(0, 10)
  const selectedDayCount = workload.find(d => d.date === selected)?.jobCount ?? 0
```

- [ ] **Step 5: Add scheduler banner and busy warning JSX**

The `{/* heading */}` block currently ends at line 125. Add the two new blocks immediately after it, before the `{/* week navigation */}` block:

```tsx
        {/* heading */}
        <div>
          <h2 className="font-display text-lg font-medium text-ink">
            {t(lang, 'workloadTitle')}
          </h2>
          <p className="mt-1 text-xs text-muted">{t(lang, 'workloadSubtitle')}</p>
        </div>

        {/* scheduler banner */}
        {schedulerNames.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-paper px-3 py-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue text-[11px] font-semibold text-paper">
              {getInitials(schedulerNames[0])}
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {t(lang, 'workloadSendingTo')}
              </p>
              <p className="text-xs font-semibold text-ink">
                {schedulerNames.join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* busy warning */}
        {!loading && selectedDayCount >= BUSY_THRESHOLD && (
          <div className="rounded-lg border border-amber bg-amber-soft px-3 py-2 text-xs text-amber">
            ⚠ {selectedDayCount} {t(lang, 'workloadBusyWarning')}
          </div>
        )}

        {/* week navigation */}
```

- [ ] **Step 6: Run type-check**

```bash
npm run type-check
```

Expected: no errors. If errors appear, fix them before committing.

- [ ] **Step 7: Commit**

```bash
git add src/features/approvals/WorkloadPreviewModal.tsx
git commit -m "feat: add scheduler banner and busy warning to WorkloadPreviewModal"
```

---

## Task 3: Manual smoke test

- [ ] **Step 1: Open the Vercel preview or run locally**

```bash
npm run dev
```

Sign in as a sales user (or use the role switcher with `ai@greenqubes.com`).

- [ ] **Step 2: Open any pending job and click "Submit for Approval"**

Verify the popup shows:
- Scheduler name banner at the top (below the title)
- Blue circle with correct initials (e.g. "KL" for Kevin Lim)
- "Sending to scheduler" label above the name

- [ ] **Step 3: Verify busy warning behaviour**

If the selected date has 5 or more jobs: amber warning appears showing the job count.
If the selected date has fewer than 5 jobs: no warning shown.
Switch to a different date in the calendar — warning should update accordingly.

- [ ] **Step 4: Push to dev**

```bash
git push origin dev
```

Confirm Vercel preview builds successfully.
