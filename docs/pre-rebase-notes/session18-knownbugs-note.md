# Session 18 — Known Bugs (carry to Session 17.4+)

_Written: 2026-05-05. These are functional bugs found during the visual audit — not design deviations._
_Fix these in Session 17.4, 17.5, etc. before or after Session 18 visual work._

---

## Bug 1 — AssistantShell: BottomNav fixed overlay may cover input bar on short viewports

**File:** `src/features/assistant/AssistantShell.tsx`

**Symptom:** On mobile viewports shorter than ~700px (or when keyboard is open), the fixed `BottomNav` (`position: fixed; bottom: 0`) sits visually on top of the `shrink-0` input bar at the bottom of the flex column. The `pb-16` on the outer div provides clearance for the messages area but the input bar itself is not guaranteed to clear the nav.

**Root cause:** The flex column is `min-h-screen pb-16 flex flex-col`. The BottomNav is out of flow (fixed). The input bar is in-flow at the bottom. If the total content height exceeds the viewport, the input bar scrolls off-screen behind the BottomNav.

**Suggested fix:** Move the input bar to a portal or keep it `sticky bottom-0` outside the scroll area. Pattern:
```tsx
// outer: flex flex-col h-screen (not min-h-screen)
// messages: flex-1 overflow-y-auto
// input: shrink-0 (stays pinned at bottom of flex col above BottomNav)
// BottomNav: renders last, fixed
// add pb-[BottomNavHeight] to account for nav overlap
```

**Priority:** Fix in 17.4 before Session 19 testing.

---

## Bug 2 — `bg-green` Tailwind collision in InstallerShell (also listed in S18 design findings)

**File:** `src/features/installer/InstallerShell.tsx` lines 122, 130

**Symptom:** The active installer tab renders with Tailwind's built-in lime-green (`#22c55e`) instead of brand forest-green (`#3F7D5C`). This is both a design deviation and a token misuse bug.

**Root cause:** `bg-green` is a Tailwind default utility. Our custom green is `bg-brand-green`. Introduced in Session 13.

**Fix:**
```tsx
// Line 122 — WRONG:
'bg-green text-white border-green'
// CORRECT:
'bg-brand-green text-white border-brand-green'

// Line 130 — WRONG:
'bg-green/15 text-green'
// CORRECT:
'bg-brand-green/15 text-brand-green'
```

**Note:** This bug was identified as F1 in `session18(summary).md` and is included in the Session 18 visual fix list. Listing here as a cross-reference.

---

## Status

| Bug | Session | Status |
|---|---|---|
| AssistantShell BottomNav + input bar overlap | 17.4 (planned) | Open |
| `bg-green` collision in InstallerShell | 18 (included in design fix pass) | Open |

---

_Previous known bugs still open:_
- React hydration error #418 on `/schedule` (production only) — see `docs/session17.3-note.md`. Do not touch without a new lead.
