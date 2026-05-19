# Dark Mode — Design Spec
_2026-05-14_

## Summary

Add a "Claude Warm" dark mode to the Greenqubes Ops app. Toggle lives in UserMenu. Preference is saved in the browser and persists across sessions on any device. On first visit with no saved preference, the app matches the device system setting (light or dark).

## Approach

Use the `next-themes` package. It handles three hard problems automatically:
- Flash prevention: injects an inline script that reads localStorage before the page paints, so the user never sees a colour flash on load
- System preference detection: reads `prefers-color-scheme` on first visit
- Persistence: writes the user's choice to `localStorage`

## Colour tokens — dark palette ("Claude Warm")

Defined under `.dark` in `globals.css`. `next-themes` adds `.dark` to `<html>` when dark mode is active.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#F4F1EC` | `#1C1A17` |
| `--paper` | `#FFFFFF` | `#242220` |
| `--ink` | `#1A1815` | `#F0EDE8` |
| `--ink2` | `#5C564E` | `#BDB8B0` |
| `--muted` | `#8B8478` | `#8B8478` (unchanged) |
| `--line` | `#E8E2D7` | `#2E2B27` |
| `--terracotta` | `#B5523D` | `#B5523D` (unchanged) |
| `--terracotta-soft` | `#F5E8E3` | `#2A1A17` |
| `--green` | `#3F7D5C` | `#3F7D5C` (unchanged) |
| `--green-soft` | `#E8F0EB` | `#172319` |
| `--blue` | `#3D6FB5` | `#3D6FB5` (unchanged) |
| `--blue-soft` | `#E5EEFC` | `#152030` |
| `--amber` | `#C8893D` | `#C8893D` (unchanged) |
| `--amber-soft` | `#F8EFDF` | `#271E10` |
| `--bad` | `#A83D3D` | `#A83D3D` (unchanged) |
| `--bad-soft` | `#F5E0E0` | `#2A1515` |

Accent colours (`--terracotta`, `--green`, `--blue`, `--amber`, `--bad`) stay the same in both modes. Only the soft/background variants darken.

## Files changed

### `package.json`
- Add `next-themes` dependency

### `src/app/globals.css`
- Add `.dark { ... }` block with all dark token overrides listed above

### `src/app/layout.tsx`
- Import `ThemeProvider` from `next-themes`
- Wrap the body content in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`
- Add `suppressHydrationWarning` to `<html>` tag (required by next-themes to suppress the expected class mismatch warning)

### `src/components/UserMenu.tsx`
- Import `useTheme` from `next-themes` and `Moon`, `Sun` from `lucide-react`
- Add `const { theme, setTheme, resolvedTheme } = useTheme()`
- Add a new row in the dropdown (between Language and Admin sections):
  - Icon: `Moon` when in light mode, `Sun` when in dark mode (based on `resolvedTheme`)
  - Label: "Dark mode" / "Light mode"
  - On click: `setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')`
  - Style matches the existing Sign out / Admin rows

## Behaviour

- **First visit, no preference saved**: follows device system setting
- **User toggles in UserMenu**: immediately switches, saves to `localStorage`
- **Next visit**: reads `localStorage`, restores last choice regardless of device system setting
- **System setting changes after user has set a manual preference**: ignored — manual choice wins
- **No page reload**: theme switch is instant, all CSS variables update in place

## Out of scope

- Per-user dark mode preference stored in Supabase (localStorage is sufficient for Phase 0)
- Separate dark mode for the login page (it has no UserMenu; it will follow system preference via CSS only if desired, but is not in scope here)
