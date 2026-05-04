# Session 13 (Extended) — Design Audit Notes

> Read at the start of Sessions 13.1–13.6 alongside CONTEXT.md and plan.md.

_Audit done: 2026-05-04 · Sub-sessions 13.1–13.5 done: 2026-05-04_

---

## What was done

Full visual audit of every page and feature file against the prototype (`docs/greenqubes-phase0.jsx`). No code was changed this session — findings only. Work is broken into sub-sessions below.

Reference sections in the prototype used during audit:

| Prototype section | Line |
|---|---|
| SHARED components (`Card`, `Pill`, `Btn`, `Field`, `Input`) | 1254 |
| SCHEDULE ROW | 1559 |
| SCHEDULE TAB | 1602 |
| JOB DETAIL / EDIT | 2589 |
| CHATBOT | 3454 |
| INSTALLER HOME — TODAY + UPCOMING | 4550 |

Design tokens confirmed in `globals.css` and `tailwind.config.ts`. All CSS variables are correct. Token naming in Tailwind (`brand-green`, `brand-blue`, `brand-amber`) does not match the shorthand used in some feature files — this is the root cause of F2 below.

---

## Findings

### F1 — `Btn` primary variant uses wrong color
**File:** `src/components/Btn.tsx`

Prototype definition:
```js
primary: { bg: C.ink,    fg: '#fff', border: C.ink    }   // near-black — commit/save
accent:  { bg: C.accent, fg: '#fff', border: C.accent }   // terracotta — create/add
ghost:   { bg: 'transparent', fg: C.ink, border: C.line } // secondary
```

Current definition:
```ts
primary:   'bg-terracotta text-white ...'  // ← wrong, should be ink
secondary: 'bg-transparent border-line ...' // this is the ghost pattern
ghost:     'bg-transparent text-ink2 ...'
```

Every "Save", "Approve", "Confirm" button appears terracotta when it should be weighty near-black. No `accent` variant exists, so there is no way to style the "New" / "Add" creation CTAs as terracotta without overriding per-call.

**Fix in 13.1:**
- Add `accent: 'bg-terracotta text-white ...'` variant
- Change `primary` to `bg-ink text-white`
- Audit all `variant="primary"` call sites — commit/save actions stay `primary`, creation actions switch to `accent`

---

### F2 — Color token class-name divergence
**Files:** `src/features/installer/InstallerShell.tsx` line 96, `src/features/approvals/ApprovalCard.tsx` line 88

Tailwind config registers colors as `brand-green`, `brand-blue`, `brand-amber`. Two files use the un-prefixed names which resolve to Tailwind's built-in palette (wrong hues):

| File | Line | Wrong | Correct |
|---|---|---|---|
| `InstallerShell.tsx` | 96 | `bg-green/10 text-green border-green/20` | `<Pill variant="installer" />` |
| `ApprovalCard.tsx` | 88 | `bg-green-soft text-green` | `bg-brand-green-soft text-brand-green` |

`bg-green-soft` has no Tailwind match at all — the background silently renders nothing. `text-green` renders Tailwind's built-in lime-green (#22c55e range), not `var(--green)` (#3F7D5C).

**Fix in 13.2.**

---

### F3 — `InstallerJobCard` border-radius and missing display font
**File:** `src/features/installer/InstallerJobCard.tsx`

- Line 25: `rounded-2xl` (16 px) → `rounded-card` (14 px — brand spec)
- Line 37: `font-medium text-ink` on client name → prototype uses `F.display` (Fraunces) for all client names in job cards; should be `font-display font-medium text-ink`

**Fix in 13.2.**

---

### F4 — `ApprovalCard` client name not Fraunces
**File:** `src/features/approvals/ApprovalCard.tsx`

- Line 43: `text-sm font-medium text-ink` → add `font-display`
- Assignee chips (line 88) — covered under F2

**Fix in 13.2.**

---

### F5 — `ApprovalsShell` has no display heading
**File:** `src/features/approvals/ApprovalsShell.tsx`

Current header: `sticky top-0` bar with `text-sm font-medium text-ink` title — no eyebrow label, no Fraunces h1.

All other pages (Schedule, Installer) follow the same pattern:
```
eyebrow: text-[11px] uppercase tracking-widest text-muted
h1:      font-display text-2xl font-medium text-ink tracking-tight
```

Approvals page stands out (badly) as the only page without this treatment.

**Fix in 13.3.**

---

### F6 — `AssistantShell` header missing avatar visual
**File:** `src/features/assistant/AssistantShell.tsx`

Prototype header:
```
[terracotta circle + Sparkles icon]  "Greenqubes Assistant"  (F.display, 15px)
                                     "with web search"       (F.body, 10px muted)
```

Current header: plain text `font-display text-base` + muted subtitle. No visual avatar anchoring the AI identity. The header bar also doesn't carry the `bg-paper border-b` treatment consistently with the rest of the panel layout.

**Fix in 13.3.**

---

### F7 — `JobDetailShell` sticky header client name not Fraunces
**File:** `src/features/job-detail/JobDetailShell.tsx`

- Line 162: `text-sm font-medium text-ink truncate` for client name in sticky header → should add `font-display`

Note: the sticky header approach (always-visible while scrolling) is an intentional improvement over the prototype's non-sticky header and should be kept. Only the font treatment needs fixing.

**Fix in 13.3.**

---

### F8 — Installer "Now" card — no active job visual treatment
**Files:** `src/features/installer/InstallerShell.tsx`, `src/features/installer/InstallerJobCard.tsx`

The prototype's `renderBigCard()` gives the active (currently-running) job a visually distinct treatment:
- 2 px green border, `C.goodBg` background
- Label badge: "NOW" + Radio icon, green pill
- Status string: "Ongoing", "Overrunning", or "Starts in X min"
- Fraunces 22 px client name
- Structured icon row: Clock / MapPin / Users with readable values
- Production ✓ / DO ✓ pills at bottom

Current `InstallerShell` has no active-job detection logic. Every job in the "Today" tab renders identically via `InstallerJobCard` — a flat card with no hierarchy. The installer cannot tell at a glance which job to focus on right now.

Active-job detection logic from prototype (to port):
```js
const currentJob = todayJobs.find(j => {
  const s = timeToMinutes(j.timeStart)
  if (s === null || s > nowMins) return false
  const e = j.timeEnd ? timeToMinutes(j.timeEnd) : s + 480
  return nowMins <= e + 60  // 1-hour grace after end
})
```

**Fix in 13.4** — biggest installer UX gap.

---

### F9 — `InstallerShell` eyebrow copy hardcoded
**File:** `src/features/installer/InstallerShell.tsx`

- Line 92: `<p>Greenqubes</p>` → prototype shows `"Hi, {firstName}"` as the eyebrow greeter

**Fix in 13.6** (small, standalone).

---

### F10 — `ScheduleShell` missing "+ New" button
**File:** `src/features/schedule/ScheduleShell.tsx`

Prototype has `<Btn icon={Plus} variant="accent">New</Btn>` in the schedule header. No job creation entry point exists in the current implementation. This requires a `/jobs/new` creation route — it is **feature work**, not just a design fix.

**Deferred as Session 13.7** — separate feature session outside the design cleanup scope.

---

### F11 — `WeekView` + `MonthView` — not audited
**Files:** `src/features/schedule/WeekView.tsx`, `src/features/schedule/MonthView.tsx`

Not read during this session. Full read + comparison against prototype's week/month grid sections needed.

**Scheduled for Session 13.5.**

---

### F12 — `ListView` date strip — already correct ✓
`src/features/schedule/ListView.tsx` line 54 uses `font-display text-base` for the day number — matches prototype. No fix needed.

---

## Sub-session plan

| Sub-session | Scope | Key files | Status |
|---|---|---|---|
| **13.1** | `Btn` variants; update all call sites | `Btn.tsx`, `ApprovalCard.tsx`, `ApprovalsShell.tsx`, `StatusSection.tsx`, `WorkloadPreviewModal.tsx`, `SendBackModal.tsx`, `ChatSection.tsx` | ✓ done |
| **13.2** | Color token names; `Pill` reuse; `InstallerJobCard` radius + font; `ApprovalCard` font | `InstallerShell.tsx`, `ApprovalCard.tsx`, `InstallerJobCard.tsx` | ✓ done |
| **13.3** | Page headers: Approvals h1, AssistantShell avatar, JobDetailShell sticky font | `ApprovalsShell.tsx`, `AssistantShell.tsx`, `JobDetailShell.tsx` | ✓ done |
| **13.4** | Installer "Now" card: detection logic + big-card component | `InstallerShell.tsx`, `NowCard.tsx` (new) | ✓ done |
| **13.5** | WeekView + MonthView read + fix | `WeekView.tsx`, `MonthView.tsx` | ✓ done |
| **13.6** | InstallerShell eyebrow greeting | `InstallerShell.tsx` | — |
| **13.7** | Bottom tab bar: role-aware fixed nav matching prototype layout | `BottomNav.tsx` (new), all shell files | — |
| *(13.8)* | *Schedule "+ New" + job creation route — deferred feature* | *`ScheduleShell.tsx` + new route* | — |

---

## What's next — Session 13.6

1. Open `src/features/installer/InstallerShell.tsx`
2. Line 92: `<p>Greenqubes</p>` → `Hi, {firstName}` eyebrow greeter
3. Extract `firstName` from `userName` prop (split on space, take first token)
4. Typecheck clean
