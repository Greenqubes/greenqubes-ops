# Session 18 — Visual Design Review: Fix Pass

_Written: 2026-05-05. All 15 planned findings fixed and typechecked clean._

---

## What was done

Full visual fix pass against the 19 findings documented in `docs/session18(summary).md`. F17 (month view hint text — harmless) and F19 (AssistantShell BottomNav/input bar overlap — deferred to 17.4) were intentionally skipped.

All 15 remaining findings fixed in one pass.

---

## Fixes applied

| Finding | Description | Files |
|---|---|---|
| F1 | `bg-green` → `bg-brand-green` (Tailwind token collision, active installer tab) | `InstallerShell.tsx` |
| F2 | Punctuality bar: `bg-terracotta` → `bg-[#D14545]` (strict = urgency red, not brand accent) | `JobRow.tsx` |
| F3 | Overdue card: `border-terracotta bg-terracotta-soft` → `border-bad bg-bad-soft` (new danger token) | `globals.css`, `tailwind.config.ts`, `JobRow.tsx` |
| F4 | h1 `text-2xl` (24px) → `text-[26px]` on Schedule, Approvals, Installer | `ScheduleShell.tsx`, `ApprovalsShell.tsx`, `InstallerShell.tsx` |
| F5 | Schedule list heading: `weekday: 'long'` → `weekday: 'short'` ("Wednesday" → "Wed") | `ScheduleShell.tsx` |
| F6 | Installer h1: `{userName}` → `{t(lang, 'installerToday')}` ("Today's run", static) | `InstallerShell.tsx` |
| F7 | Approvals eyebrow: hardcoded "Greenqubes" → `{t(lang, 'approvalsSubtitle')}` + new i18n key | `ApprovalsShell.tsx`, `en.ts`, `zh.ts`, `bn.ts` |
| F8 | ApprovalCard approve button: `variant="primary"` → `variant="accent"` (terracotta CTA) | `ApprovalCard.tsx` |
| F9 | ApprovalCard assignees icon: `Clock` → `Users` | `ApprovalCard.tsx` |
| F10 | JobRow description text: `text-sm` (14px) → `text-[13px]` | `JobRow.tsx` |
| F11 | JobRow meta row text: `text-xs` (12px) → `text-[11px]` | `JobRow.tsx` |
| F12 | WeekView empty dash: `text-sm` → `text-xs` | `WeekView.tsx` |
| F13 | WeekView today label: plain uppercase span → terracotta pill (`bg-terracotta-soft`, `text-terracotta`, `rounded-full`) | `WeekView.tsx` |
| F14 | MonthView cell: `rounded-lg` (8px) → `rounded-md` (6px) | `MonthView.tsx` |
| F15 | Btn: `rounded-lg` (8px) → `rounded-[10px]` — affects every button in the app | `Btn.tsx` |
| F16 | InstallerJobCard: add description line (`text-[13px] text-ink2 line-clamp-1`) after client | `InstallerJobCard.tsx` |
| F18 | Installer eyebrow: hardcoded `"Hi"` → `{t(lang, 'installerHi')}` + new i18n key | `InstallerShell.tsx`, `en.ts`, `zh.ts`, `bn.ts` |

---

## New CSS tokens added

```css
/* globals.css :root */
--bad:      #A83D3D;   /* overdue / danger red */
--bad-soft: #F5E0E0;   /* overdue background */
```

```ts
// tailwind.config.ts
bad: {
  DEFAULT: 'var(--bad)',
  soft:    'var(--bad-soft)',
},
```

---

## New i18n keys added

| Key | en | zh | bn |
|---|---|---|---|
| `approvalsSubtitle` | Pending requests from sales | 销售发来的待审请求 | বিক্রয় থেকে অনুমোদনের অনুরোধ |
| `installerHi` | Hi | 你好 | হ্যালো |

---

## Skipped / deferred

| Finding | Reason |
|---|---|
| F17 — Month view hint text | Harmless UX addition; prototype had it implicit. Keep. |
| F19 — AssistantShell BottomNav/input bar overlap | Functional bug, not visual. Deferred to Session 17.4. |

---

## TypeScript

`npx tsc --noEmit` — clean, no errors.

---

## What's next

- Commit + push to `dev`, confirm Vercel preview deploys
- Session 17.4 — fix AssistantShell BottomNav/input bar overlap (Bug 1 in `session18-knownbugs-note.md`)
- Session 19 — Pre-Alpha solo end-to-end test on Vercel preview (mobile + desktop)
