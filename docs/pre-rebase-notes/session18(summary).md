# Session 18 — Visual Design Review: Pre-Work Summary

_Written: 2026-05-05. Read this at the start of Session 18 before touching any code._

> **Ground rules (from CLAUDE.md)**
> Session 18 is exclusively visual. No feature work, no refactoring.
> New bugs found here → `docs/session18-knownbugs-note.md` → fix in Session 17.4+.
> Reference prototype: `docs/greenqubes-phase0.jsx`.

---

## Files read during audit

All source files read to compile these findings:

- `src/features/schedule/ScheduleShell.tsx`
- `src/features/schedule/ListView.tsx`
- `src/features/schedule/WeekView.tsx`
- `src/features/schedule/MonthView.tsx`
- `src/features/schedule/JobRow.tsx`
- `src/features/job-detail/JobDetailShell.tsx`
- `src/features/job-detail/CoreSection.tsx`
- `src/features/job-detail/NewJobShell.tsx`
- `src/features/job-detail/StatusSection.tsx`
- `src/features/approvals/ApprovalsShell.tsx`
- `src/features/approvals/ApprovalCard.tsx`
- `src/features/installer/InstallerShell.tsx`
- `src/features/installer/InstallerJobCard.tsx`
- `src/features/installer/NowCard.tsx`
- `src/features/assistant/AssistantShell.tsx`
- `src/features/admin/AdminShell.tsx`
- `src/features/notifications/NotificationDrawer.tsx`
- `src/components/BottomNav.tsx`
- `src/components/Btn.tsx`
- `src/components/Pill.tsx`
- `src/components/Card.tsx`
- `src/components/UserMenu.tsx`
- `src/app/globals.css`
- `tailwind.config.ts`
- `src/lib/i18n/en.ts`
- `docs/greenqubes-phase0.jsx` (sections 828–5000: tokens, Schedule, JobDetail, Installer, Chatbot)

---

## Screen order for Session 18

1. Schedule — List view
2. Schedule — Week view
3. Schedule — Month view
4. Job Detail (edit)
5. New Job
6. Approvals
7. Installer Dashboard
8. Assistant
9. Admin

---

## All findings

### 🔴 Priority 1 — Wrong color tokens (visible, breaking brand)

#### F1 — `bg-green` / `text-green` / `border-green` collision in InstallerShell
**File:** `src/features/installer/InstallerShell.tsx` lines 122, 130

Tailwind's built-in `green` = `#22c55e` (lime/neon green), not our brand green `#3F7D5C`.
The active installer tab renders lime-green instead of forest green. This is the single biggest color bug.

```tsx
// WRONG (lines 122, 130):
'bg-green text-white border-green'
'bg-green/15 text-green'

// CORRECT:
'bg-brand-green text-white border-brand-green'
'bg-brand-green/15 text-brand-green'
```

---

#### F2 — Strict punctuality bar uses terracotta instead of bright red
**File:** `src/features/schedule/JobRow.tsx` line 41–43

Prototype uses `C.red = '#D14545'` for the strict punctuality bar. Our app uses `bg-terracotta` (`#B5523D`) which is the brand accent — a warm terracotta-orange, not a true urgency red. These should be visually distinct.

```tsx
// WRONG:
job.punctuality === 'strict' ? 'bg-terracotta' : 'bg-brand-blue'

// CORRECT — add a CSS var or use literal:
job.punctuality === 'strict' ? 'bg-[#D14545]' : 'bg-brand-blue'
```

---

#### F3 — Overdue state uses brand terracotta instead of danger red
**File:** `src/features/schedule/JobRow.tsx` line 30–36

Prototype overdue: border `#A83D3D` (dark muted red), background `#F5E0E0` (cool pinkish).
Our app: border `border-terracotta` (`#B5523D`), background `bg-terracotta-soft` (`#F5E8E3`). The terracotta is warm orange — distinct from danger red.

**Fix options (discuss at start of session):**
- Add `--bad: #A83D3D` and `--bad-soft: #F5E0E0` CSS variables in `globals.css` + Tailwind config
- Use literal classes `border-[#A83D3D] bg-[#F5E0E0]` inline (simpler, no new token)

Recommendation: add the `--bad` token so it's reusable (overdue badge, notification drawer, etc.).

---

### 🟠 Priority 2 — Display font / heading sizes

#### F4 — Schedule header h1 is 24px instead of 26px
**File:** `src/features/schedule/ScheduleShell.tsx` line 182

Prototype `ScheduleTab` h1: `fontSize: 26`. Ours: `text-2xl` = 24px.

```tsx
// WRONG:
<h1 className="font-display text-2xl font-medium ...">

// CORRECT:
<h1 className="font-display text-[26px] font-medium ...">
```

Same fix applies to `ApprovalsShell.tsx` h1, `InstallerShell.tsx` h1.

---

#### F5 — Schedule list-view heading shows full weekday ("Wednesday") instead of short ("Wed")
**File:** `src/features/schedule/ScheduleShell.tsx` lines 143–148

```tsx
// WRONG:
.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })

// CORRECT:
.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
```

Prototype: `"Wed, 7 May"`. Our app: `"Wednesday, 7 May"`. The long form pushes the nav chevrons tighter on narrow screens.

---

#### F6 — Installer h1 shows username instead of "Today's run"
**File:** `src/features/installer/InstallerShell.tsx` lines 103–106

Prototype eyebrow: `Hi, {firstName}` → h1: `t.installerToday` = "Today's run" (26px).
Our app eyebrow: `Hi, {firstName}` ✅ → h1: `{userName}` = "Kai Chen" ❌.

The h1 should describe the tab content, not repeat the user identity (which is in UserMenu avatar).

```tsx
// WRONG:
<h1 className="font-display text-2xl ...">
  {userName}
</h1>
<Pill variant="installer" className="mt-1.5" />

// CORRECT:
<h1 className="font-display text-[26px] ...">
  {t(lang, 'installerToday')}   {/* changes to installerHistoryTitle when on Past tab */}
</h1>
```

The h1 should also update per tab: "Today's run" → "Up next" → "This week" → "Past jobs" — or keep it as the user's name with a sub-line. Decision to make at session start.

---

### 🟡 Priority 3 — Component-level visual deviations

#### F7 — Approvals header eyebrow is hardcoded "Greenqubes"
**File:** `src/features/approvals/ApprovalsShell.tsx` line 61

```tsx
// WRONG:
<p className="text-[11px] text-muted uppercase tracking-widest mb-0.5">Greenqubes</p>

// CORRECT — add 'approvalsSubtitle' to i18n and use:
<p className="text-[11px] text-muted uppercase tracking-widest mb-0.5">
  {t(lang, 'approvalsSubtitle')}
</p>
```

Add to `en.ts`: `approvalsSubtitle: 'Pending requests from sales'`
Add to `zh.ts`: `approvalsSubtitle: '销售发来的待审请求'`
Add to `bn.ts`: `approvalsSubtitle: 'বিক্রয় থেকে অনুমোদনের অনুরোধ'`

---

#### F8 — ApprovalCard "Approve" button uses wrong variant
**File:** `src/features/approvals/ApprovalCard.tsx` line 96

Prototype CTA is terracotta (accent). Our implementation uses `variant="primary"` (ink/dark).

```tsx
// WRONG:
<Btn variant="primary" size="sm" onClick={onApprove}>

// CORRECT:
<Btn variant="accent" size="sm" onClick={onApprove}>
```

---

#### F9 — ApprovalCard assignees use wrong icon (Clock → Users)
**File:** `src/features/approvals/ApprovalCard.tsx` line 82

```tsx
// WRONG:
<Clock size={11} className="text-muted shrink-0" />

// CORRECT:
<Users size={11} className="text-muted shrink-0" />
```
(Also add `Users` to the import.)

---

#### F10 — JobRow description text is 14px instead of 13px
**File:** `src/features/schedule/JobRow.tsx` line 58

```tsx
// WRONG:
<p className="text-sm text-ink2 leading-snug mb-2 line-clamp-1">

// CORRECT:
<p className="text-[13px] text-ink2 leading-snug mb-2 line-clamp-1">
```

---

#### F11 — JobRow meta row text is 12px instead of 11px
**File:** `src/features/schedule/JobRow.tsx` lines 65–75

```tsx
// WRONG (multiple):
<span className="flex items-center gap-1 text-xs text-muted">

// CORRECT:
<span className="flex items-center gap-1 text-[11px] text-muted">
```

---

#### F12 — WeekView empty-day dash is 14px instead of 12px
**File:** `src/features/schedule/WeekView.tsx` line 49

```tsx
// WRONG:
<p className="pl-3 text-sm text-muted italic">—</p>

// CORRECT:
<p className="pl-3 text-xs text-muted italic">—</p>
```

---

#### F13 — WeekView "today" label missing pill treatment
**File:** `src/features/schedule/WeekView.tsx` lines 37–40

Prototype wraps "today" in `<Pill tone="accent">today</Pill>` (terracotta pill). Our app renders a plain `<span className="text-[10px] font-medium text-terracotta uppercase tracking-wide">`.

```tsx
// WRONG:
<span className="text-[10px] font-medium text-terracotta uppercase tracking-wide">
  {t(lang, 'filterToday')}
</span>

// CORRECT — use existing Pill but with a small custom style, or a local span:
<span className="inline-flex items-center px-2 py-0.5 rounded-full bg-terracotta-soft text-terracotta text-[10px] font-medium">
  today
</span>
```

---

#### F14 — MonthView cell border-radius is 8px instead of 6px
**File:** `src/features/schedule/MonthView.tsx` line 61

```tsx
// WRONG:
'aspect-square rounded-lg border ...'

// CORRECT:
'aspect-square rounded-md border ...'
```

`rounded-lg` = 8px, `rounded-md` = 6px (matches prototype's `borderRadius: 6`).

---

#### F15 — Btn border-radius is 8px instead of 10px
**File:** `src/components/Btn.tsx` line 34

Prototype Btn: `borderRadius: 10`. Our `rounded-lg` = 8px.

```tsx
// WRONG:
'rounded-lg font-medium lowercase tracking-wide'

// CORRECT:
'rounded-[10px] font-medium lowercase tracking-wide'
```

This affects every button in the app — high impact, correct once here.

---

#### F16 — InstallerJobCard missing job description line
**File:** `src/features/installer/InstallerJobCard.tsx`

Prototype's ScheduleRow (used for non-current-job cards) shows the job description (13px, ink2). Our InstallerJobCard shows: Pill+date, client, time, location — no description.

Add after client line:
```tsx
{job.description && (
  <p className="text-[13px] text-ink2 line-clamp-1 leading-snug">{job.description}</p>
)}
```

---

### 🟢 Priority 4 — Low-impact / polish

#### F17 — Month view shows "tap a date to see jobs" hint text
**File:** `src/features/schedule/MonthView.tsx` line 96

Prototype has no such hint. It's extra but harmless. Keep or remove — minor.

---

#### F18 — "Hi" greeting hardcoded in InstallerShell (i18n gap)
**File:** `src/features/installer/InstallerShell.tsx` line 102

`Hi, {firstName}` — "Hi" is hardcoded English. Add `installerHi: 'Hi'` / `'你好'` / `'হ্যালো'` to i18n and use `{t(lang, 'installerHi')}, {firstName}`.

---

#### F19 — AssistantShell: BottomNav vs input bar ordering in JSX
**File:** `src/features/assistant/AssistantShell.tsx` line 229

`BottomNav` renders before the input bar in JSX but is `position: fixed` so doesn't affect layout. On some browsers the fixed BottomNav could sit on top of the last message. The `pb-16` on the outer div is the intended safeguard. Low risk but worth verifying on mobile viewport. If input bar appears behind nav: swap BottomNav to render after input bar, or increase pb.

---

## Fix order for Session 18

Work in this order, one finding at a time, test in browser between each:

1. **F1** — `bg-green` collision in InstallerShell ← Start here
2. **F2 + F3** — Punctuality bar + overdue colors (add `--bad` token if going that route)
3. **F4** — Schedule h1 size (26px) — also fix Approvals + Installer h1 at same time
4. **F5** — Schedule heading weekday format (long → short)
5. **F6** — Installer h1 content ("Today's run" instead of name)
6. **F7** — Approvals eyebrow + add approvalsSubtitle i18n key
7. **F8** — ApprovalCard approve button variant (primary → accent)
8. **F9** — ApprovalCard icon (Clock → Users)
9. **F10 + F11** — JobRow description + meta text sizes
10. **F12** — WeekView empty dash size
11. **F13** — WeekView today pill
12. **F14** — MonthView cell radius (rounded-lg → rounded-md)
13. **F15** — Btn radius (rounded-lg → rounded-[10px]) — do last since it touches everything
14. **F16** — InstallerJobCard description line
15. **F18** — `installerHi` i18n key

---

## Not changed — rationale

| Item | Reason |
|---|---|
| Sticky header in JobDetail | Our improvement — prototype had no sticky. Keep. |
| Back button as icon-only | Consistent with other app shells; prototype was single-page |
| Month view hint text | Harmless UX addition; prototype had it implicit |
| New Job sticky bar | Matches JobDetail pattern established in S13.8 |
| Admin page | Added in S14; no prototype reference — no changes needed |
| BottomNav tab set | Matches prototype role-aware nav (scheduler 3, sales 2, installer 2) ✅ |

---

## CSS token to add (for F2 + F3)

In `src/app/globals.css` `:root`:
```css
--bad:      #A83D3D;   /* overdue / danger red — distinct from terracotta brand accent */
--bad-soft: #F5E0E0;   /* overdue background */
```

In `tailwind.config.ts` `colors`:
```ts
bad: {
  DEFAULT: 'var(--bad)',
  soft:    'var(--bad-soft)',
},
```

Then in `JobRow.tsx`:
```tsx
overdue ? 'border-bad bg-bad-soft' : ...
// punctuality bar:
job.punctuality === 'strict' ? 'bg-[#D14545]' : 'bg-brand-blue'
```

---

## Files changed in Session 18 (expected)

| File | Change |
|---|---|
| `src/app/globals.css` | Add `--bad`, `--bad-soft` tokens |
| `tailwind.config.ts` | Add `bad` color |
| `src/features/installer/InstallerShell.tsx` | F1 (bg-green), F6 (h1), F18 (installerHi) |
| `src/features/schedule/JobRow.tsx` | F2, F3, F10, F11 |
| `src/features/schedule/ScheduleShell.tsx` | F4, F5 |
| `src/features/schedule/WeekView.tsx` | F12, F13 |
| `src/features/schedule/MonthView.tsx` | F14 |
| `src/features/approvals/ApprovalsShell.tsx` | F4 (h1), F7 (eyebrow) |
| `src/features/approvals/ApprovalCard.tsx` | F8, F9 |
| `src/features/installer/InstallerJobCard.tsx` | F16 |
| `src/components/Btn.tsx` | F15 |
| `src/lib/i18n/en.ts` | F7 (approvalsSubtitle), F18 (installerHi) |
| `src/lib/i18n/zh.ts` | F7, F18 |
| `src/lib/i18n/bn.ts` | F7, F18 |

---

## At end of Session 18

Write `docs/session18-note.md` with all findings + fixes.
Update `docs/plan.md` and `docs/CONTEXT.md` last-updated dates.
Update Session 18 checkbox in migration plan.
