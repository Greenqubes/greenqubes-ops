# Sessions 13.6 + 13.7 — Bottom Nav, User Menu, Eyebrow Greeting

> Read alongside `CONTEXT.md` and `plan.md` at session start.

_Done: 2026-05-04_

---

## What was built

### Session 13.6 — Eyebrow greeting (F9)

**File:** `src/features/installer/InstallerShell.tsx`

- Replaced hardcoded `"Greenqubes"` eyebrow label with `"Hi, {firstName}"`
- `firstName` derived as `userName.split(' ')[0]` — first token of the full name string

---

### Session 13.7 — Bottom tab bar (BottomNav)

**New file:** `src/components/BottomNav.tsx`

Fixed `position: fixed, bottom: 0` tab bar, role-aware. Matches prototype layout.

Tab mapping:

| Role | Tabs |
|---|---|
| scheduler | Schedule `/schedule` · Approvals `/approvals` · Assistant `/assistant` |
| sales | Schedule `/schedule` · Assistant `/assistant` |
| installer | My Jobs `/installer` · Assistant `/assistant` |

- Active tab: `text-terracotta`, `strokeWidth={2}`
- Inactive: `text-muted`, `strokeWidth={1.6}`, `hover:text-ink2`
- Icon size: 20px, label: 10px uppercase tracking-wide
- iOS safe-area handled: `pb-[env(safe-area-inset-bottom,12px)]`
- **Web/mobile fix:** outer `<nav>` is `left-0 right-0` (full viewport width, `bg-paper border-t` stretches edge-to-edge). Tabs constrained inside `<div className="max-w-[480px] mx-auto flex">`. The earlier `left-1/2 -translate-x-1/2 max-w-[480px]` approach left the white bar clipped to 480px on desktop.

**Shell changes:**

| File | Change |
|---|---|
| `ScheduleShell.tsx` | Removed Bot icon link from header; added `<BottomNav role={role ?? 'sales'} />` |
| `ApprovalsShell.tsx` | Removed ArrowLeft back link (BottomNav handles nav); added `<BottomNav role="scheduler" />`; `py-6` → `pt-6 pb-24` |
| `InstallerShell.tsx` | Removed Bot icon link; `pb-10` → `pb-24`; added `<BottomNav role="installer" />` |
| `AssistantShell.tsx` | Added `role` to destructured props; outer div gets `pb-16` so input bar clears fixed nav; added `<BottomNav role={role} />` |
| `WeekView.tsx` | `pb-6` → `pb-24` |
| `MonthView.tsx` | `pb-6` → `pb-24` |
| `ListView.tsx` | `pb-6` → `pb-24` |

---

### Session 13.6 (extended) — UserMenu avatar

**New file:** `src/components/UserMenu.tsx`

Self-contained client component. No props — fetches the signed-in user from `supabase.auth.getUser()` on mount, reading `user_metadata.full_name` (Google OAuth populates this automatically).

- **Initials:** first letter of first word + first letter of last word, uppercase. Single-word names use just the one letter.
- **Colour:** deterministic hash of the name mod 5, cycling through `bg-terracotta`, `bg-brand-green`, `bg-brand-blue`, `bg-brand-amber`, `bg-ink2`. Same person always gets the same colour.
- **Dropdown:** opens on click, closes on outside `pointerdown`. Contains name, email, and a Sign out button (calls `supabase.auth.signOut()` then redirects to `/login`).
- **Placement:** rightmost icon in every shell header.

**Shell changes:**

| File | Change |
|---|---|
| `InstallerShell.tsx` | Replaced old `handleSignOut` + `LogOut` button with `<UserMenu />`; removed `useRouter`, `createClient`, `LogOut` imports |
| `ScheduleShell.tsx` | `<UserMenu />` added rightmost in header icon row (after search toggle) |
| `ApprovalsShell.tsx` | `<UserMenu />` added after queue count badge in sticky header |

---

## Key decisions

- `UserMenu` is self-contained (no props) to avoid threading `userName` through every page → server component. It fetches from the client-side auth session which is always available after login.
- `BottomNav` outer nav spans full width; inner div constrains to 480px. This was the fix for the clipped white bar on desktop browsers.
- `AssistantShell` uses `pb-16` on the outer flex wrapper (not a spacer element) because the input bar is `shrink-0` at the bottom of a `flex-col` — reducing the content area by 64px pushes the input bar above the fixed nav.
- ApprovalsShell lost its ArrowLeft back-to-schedule link because the BottomNav's Schedule tab now serves that purpose for schedulers.

---

## Files touched

```
src/components/BottomNav.tsx          — new
src/components/UserMenu.tsx           — new
src/features/installer/InstallerShell.tsx
src/features/schedule/ScheduleShell.tsx
src/features/approvals/ApprovalsShell.tsx
src/features/assistant/AssistantShell.tsx
src/features/schedule/WeekView.tsx
src/features/schedule/MonthView.tsx
src/features/schedule/ListView.tsx
```

---

## What's next — Session 14

`admin` page at `/admin` (scheduler-only):

1. **User list** — all users in `public.users`, showing name, role, Telegram chat ID, last active
2. **Provision new user** — insert into `public.users` with `auth_id` matched from `auth.users` by email; role selector
3. **Edit user** — change role, Telegram chat ID
4. **Digest voter config** — who receives the Monday digest (boolean toggle per user)
5. **System health** — Supabase reachable, Telegram bot token valid, last obsidian-sync timestamp, last overdue-cron run (from `events` table)

Key constraint: admin page must be scheduler-only, enforced at the server page level (redirect non-schedulers to `/schedule`).
