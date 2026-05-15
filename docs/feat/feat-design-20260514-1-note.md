# feat-design — Session Note
_2026-05-14_

---

## What was done

### Dark mode — Claude Warm palette

Added a full dark mode to the app using `next-themes`. The toggle lives in UserMenu (between Language and Admin shortcuts). Preference is saved in `localStorage` and survives browser restarts on any device. On first visit with no saved preference, the app follows the device system setting.

**Palette chosen:** Claude Warm — warm charcoal backgrounds, off-white text, accents unchanged.

| Token | Dark value |
|---|---|
| `--bg` | `#1C1A17` |
| `--paper` | `#242220` |
| `--ink` | `#F0EDE8` |
| `--ink2` | `#BDB8B0` |
| `--muted` | `#8B8478` (same) |
| `--line` | `#2E2B27` |
| Soft variants | darkened to match |

#### New files

**`src/components/ThemeProvider.tsx`**
Thin `'use client'` wrapper around `NextThemesProvider`. Needed because Next.js App Router server components can't use React context directly.

#### Files changed

- `src/app/globals.css` — added `.dark {}` token block
- `src/app/layout.tsx` — import ThemeProvider, wrap body, add `suppressHydrationWarning` to `<html>`
- `src/components/UserMenu.tsx` — `useTheme` hook, `mounted` guard, Moon/Sun toggle button

### Dark mode contrast fixes

After testing, `bg-ink text-white` elements were invisible in dark mode — `--ink` flips to off-white but `text-white` is hardcoded. Fixed by replacing `text-white` with `text-paper` (which maps to `--paper`, dark in dark mode) across 8 files:

- `src/components/UserMenu.tsx` — language button selected state
- `src/components/Btn.tsx` — primary button variant
- `src/features/schedule/ScheduleShell.tsx` — search toggle + view mode buttons
- `src/features/schedule/MonthView.tsx` — selected date
- `src/features/schedule/ListView.tsx` — selected date
- `src/features/installer/InstallerShell.tsx` — search toggle + view mode buttons
- `src/features/assistant/HistorySidebar.tsx` — toast banner
- `src/app/assistant/history/MobileHistoryShell.tsx` — toast banner

---

## What's next

- Fix AdminRoleModal double-Yes bug
- Installer clash warning (Nic to explain details next session)
- Voice note: live audio waveform while recording
- Scheduler tab: Send Back on scheduled jobs
- Scheduler tab: Delete job
- Sales tab: Recall Job
- Sales tab: pre-send popup showing scheduler load
