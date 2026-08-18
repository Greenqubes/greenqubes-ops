---
session: visual-design (Company logo palette rebrand + clickable top-bar logo)
date: 2026-08-18
branch: dev → main (two merges, all live on production same day)
---

# Logo Palette Rebrand + Clickable Logo — DONE

> The app's accent colors moved from the warm-editorial terracotta set to the
> company logo palette (Nic supplied a 5-swatch strip; lime `#91C740` + slate
> `#6C747C` are the logo anchors). Scope: **accents only** — neutrals, red and
> all layout untouched. Punctuality red/blue got extracted into fixed signal
> tokens after Nic caught them changing. Also: the top-bar logo now links to
> /schedule.

## 1 — Clickable top-bar logo (first merge to main)

- The GreenQubes logo in `CompanyBar.tsx` (shared by every shell) is wrapped
  in a `Link` to `/schedule` — works as a "go home" button app-wide.
- `/schedule/page.tsx` gained the installer bounce (`effectiveRole ===
  'installer'` → redirect `/installer`), copied from the `/fcfs` pattern.
  Installers never had a Schedule tab; now they can't land there via the logo
  either.

## 2 — Accent rebrand (second merge, together with §3)

Nic's decisions (via option questions):
- **Scope: accents only** — cream bg / white paper / ink text / lines stay.
- **Buttons: darker lime + white text** — true lime `#91C740` fails white-text
  contrast badly (~2:1), so the primary is the logo lime darkened to pass
  4.5:1; the true lime is reserved for small non-text highlights.
- **Installer/success: teal, not a second green** — the company green must
  stay the only green in the app.

Token remap in `globals.css` (NAMES kept for compatibility — `--terracotta`
et al. appear throughout the code; only VALUES changed, comment in the file
+ CONTEXT.md explain):

| Token | Old | New | Role |
|---|---|---|---|
| `--terracotta` | #B5523D | **#5A801F** moss green | primary accent (4.6:1 on white text) |
| `--lime` (NEW) | — | **#91C740** true logo lime | small highlights only: chat live dot, favicon |
| `--blue` | #3D6FB5 | **#6C747C** logo slate | info/secondary (4.7:1, no tuning needed) |
| `--green` | #3F7D5C | **#3E7F7B** teal | installer/success (4.6:1) |
| `--amber` | #C8893D | **#A9852F** sand gold | warnings |
| `--bad` | #A83D3D | unchanged | red is safety, not brand |

- All five light-mode soft tints re-derived; dark-mode softs regenerated in
  the existing very-dark-tint style.
- Tailwind: added `brand-lime`; everything else flows through the CSS vars.
- Favicon (`icon.tsx`): terracotta tile + white G → lime tile + dark-ink G.
- Chat "Live" dot: `bg-brand-green` → `bg-brand-lime`.
- Deliberately NOT touched: `ChatSection` doc-icon colors (PDF red / Word
  blue / Excel green are file-format conventions, not app accents).

## 3 — Punctuality = fixed company signal colors (Nic caught this)

On the preview Nic spotted the Punctuality toggle showing green/grey:
**strict = red, flexible = blue is a company scheduling indicator**, not a
brand color. Fix: dedicated tokens, deliberately outside the brand palette —

```css
--punct-strict: #D14545;  --punct-strict-soft: #F5E8E3;  /* dark: #2A1A17 */
--punct-flex:   #3D6FB5;  --punct-flex-soft:   #E5EEFC;  /* dark: #152030 */
```

- **Never rebrand these** — rule recorded in CONTEXT.md next to the tokens.
- Discovery: the app previously used TWO reds for strict — `#D14545` on
  schedule rows/legend/date strip (the 18.2 "strict legend colour"), but
  brand terracotta on the job-form toggle and FCFS bars. Standardised on
  `#D14545` everywhere.
- Rewired surfaces: CoreSection toggle (shared by New/Edit job), JobRow bar,
  ListView legend, DateStrip dots (two spots — the strict-only dot at line
  ~145 was nearly missed), MonthView dots, FCFSTimeline `BAR_CLASS`
  (flex/strict/flex-warn; `strict-clash` stays `--bad`), FCFSShell legend,
  AssignmentPanel pill, ExternalHomePage + ExternalJobDetail chips.

## Facts worth keeping

- **Hardcoded-hex sweep matters in a token rebrand**: the favicon, JobRow's
  `bg-[#D14545]`, ListView/DateStrip literals were all outside the token
  system. Grep for the old hex values, not just token usages.
- Tailwind color names (`terracotta`, `brand-blue`…) now describe roles, not
  hues — `bg-terracotta` renders moss green. Kept to avoid a 100+ file
  rename; CONTEXT.md documents it.
- Amber/suggestion coloring on FCFS stayed on the brand token (now sand
  gold) — Nic only flagged red/blue as signals. If he ever calls amber a
  signal too, same `--punct-*` treatment applies.

## Key files

| File | Change |
|---|---|
| `src/app/globals.css` | all token values, `--lime`, `--punct-*` (light + dark) |
| `tailwind.config.ts` | `brand-lime`, `punct-strict`, `punct-flex` |
| `src/components/CompanyBar.tsx` | logo wrapped in Link → /schedule |
| `src/app/schedule/page.tsx` | installer bounce → /installer |
| `src/app/icon.tsx` | lime favicon, dark G |
| CoreSection / JobRow / ListView / DateStrip / MonthView / FCFSTimeline / FCFSShell / AssignmentPanel / ExternalHomePage / ExternalJobDetail | punctuality → `punct-*` classes |
| `docs/CONTEXT.md` | token block rewritten + "never rebrand punctuality" rule |

## ⚠️ Notes for next session

- **Session 21 alpha testing remains the milestone.** Blocker unchanged:
  provision the scheduler's account + Telegram chat ID (nic-checklist top).
- Rebrand is live on production; if any page looks off in dark mode it's a
  soft-tint tune, not a re-map — shades can be tweaked token-by-token.
- Still outstanding (pre-go-live): backup health event + Telegram watchdog
  decision, old-DB-password sweep, test external contacts cleanup, Wei Qing
  TG chat ID removal.
