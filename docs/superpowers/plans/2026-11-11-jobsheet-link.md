# Old Jobsheet Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nic's old "Greenqubes Jobs" Google Sheet fills itself with the app's scheduled jobs. A script inside the sheet pulls one week at a time from a private app link and writes the jobs into each weekly tab, below a yellow marker bar. It creates next week's tab by itself and never touches the rows people type.

**Architecture:**
- **App:** a pure, tested row builder turns a week of scheduled jobs and leave into ready-to-write rows in the sheet's 12 columns. An unauthenticated JSON route serves them behind a secret key. The key is kept in `app_settings`, and Admin → Settings can show, copy and change the link.
- **Sheet:** a plain Apps Script file kept in the repo. Its pure helpers (reading tab names, finding the marker, naming new tabs) are tested in Node by loading the `.gs` file into a `vm` context, so there is one copy of the logic.
- The app never calls Google.

**Tech Stack:** Next.js 15 route handlers, Supabase service key, TypeScript, Google Apps Script (V8), Node `vm` for testing the script's pure helpers.

**Spec:** `docs/superpowers/specs/2026-11-11-gallery-groups-bulk-sheet-design.md`, Part 2. Real-data preview Nic approved: https://claude.ai/artifact/MZfiqDKVS4SVdjFDvTU24L (option 2).

## Global Constraints

- One way only: app → sheet. Nothing reads typed rows, and nothing writes above the marker.
- The app never calls Google.
- Only `status = 'scheduled'` jobs. Never drafts, ongoing, completed or prices.
- Contact numbers ARE included.
- Leave lines show names only. Never the leave type or note.
- Dates and day names are always English.
- The link key lives in `app_settings` (key `jobsheet_link_key`), never in an env var. Only the real admin role may see or change it.
- No migration. `app_settings` exists (0063), predates 2026-10-30 (grants intact), and is read and written only with the service key.
- Admin → Settings is English-only today (`SettingsTab.tsx` hard-codes its text). The new card follows that, so no i18n keys.
- No emoji. Any confirm step is built into the page; never `window.confirm`.
- Tests: standalone `npx tsx <file>.test.ts` with the repo's `check()` helper.
- Full suite command:
  `bash -c 'fails=0; n=0; for f in $(git ls-files "*.test.ts"); do n=$((n+1)); npx tsx "$f" >/dev/null 2>&1 || { echo "FAIL $f"; fails=$((fails+1)); }; done; echo "files=$n fails=$fails"; [ $fails -eq 0 ]'`

## Review Focus

1. **A wrong, missing or old key** must answer a bare 404 that reveals nothing, in constant time. Test `keysMatch` with a wrong key, a different-length key, a missing key and a null stored key.
2. **A tab name the script can't read, or a typo'd week**, must be ignored, never written to. Nic's real tab "22/11 to29/11" starts on a Sunday; it must map to the week of Mon 23 Nov via its END date. Covered by the `weekOfTab` tests.
3. **A tab with two marker bars, or a failed fetch**, must be left exactly as it was. Test `findMarker` returning `-2` for two markers; the refresh code checks it before writing.
4. **The December–January turn:** "28/12 to3/1" read on 30 Dec 2026 is week 2026-12-28, and on 2 Jan 2027 is still 2026-12-28. Test both.
5. **A job with no time, a job past midnight, a multi-day job.** Untimed sorts first. "23:45-05:00" reads "11:45 PM - 5:00 AM". A job dated 15–16 Nov appears on both days. Test in `buildWeekRows`.

---

### Task 1: Sheet rows (pure)

**Files:**
- Create: `src/lib/utils/jobsheet-rows.ts`
- Test: `src/lib/utils/jobsheet-rows.test.ts`

**Interfaces:**
- Consumes: `Crew` from `src/lib/utils/installer-crew.ts` (`{ drivers; support; externals: CrewPerson[] }`).
- Produces:
  - `SHEET_COLUMNS: readonly string[]` = `['Date','Day','Production','Contact Person','Punctuality','Time','Jobs Description','Location / Sites','DO','PIC','Remarks','Job Time']`
  - `type SheetJob = { id: string; date: string; date_end: string | null; time_start: string | null; time_end: string | null; punctuality: 'strict' | 'flexible'; project_title: string | null; client: string; description: string | null; location: string; client_poc_name: string | null; client_poc_phone: string | null; salesName: string | null; crew: Crew }`
  - `type SheetLeave = { name: string; date_start: string; date_end: string }`
  - `type SheetRow = { type: 'gap' | 'day' | 'leave' | 'job'; cells: string[]; punctuality?: 'strict' | 'flexible' }`, where `cells` always has length 12
  - `sheetTime(start: string | null, end: string | null): string`
  - `crewLine(crew: Crew): string`
  - `parseWeek(raw: unknown): string | null`, which returns the date only if it is a real `YYYY-MM-DD` that falls on a Monday
  - `buildWeekRows(monday: string, jobs: SheetJob[], leaves: SheetLeave[]): SheetRow[]`

**Row rules:**
- For each of the 7 days, in order:
  1. a `gap` row (all cells `''`)
  2. a `day` row with cells[0] `'11-Nov'` and cells[1] `'Wed'`
  3. a `leave` row if anyone is on leave that day (`date_start <= day <= date_end`), with cells[6] `'On leave: A, B'` in the order the leaves were given
  4. that day's `job` rows: jobs where `date <= day <= (date_end ?? date)`, sorted by `time_start` with untimed first
- **Job row cells:**
  - [0] and [1] are `''`
  - [3] Contact Person: name and phone joined with `'\n'` (either may be missing)
  - [4] `'Strict'` or `'Flexible'`
  - [5] `sheetTime`
  - [6] Jobs Description: title, or client if no title, then `'\n'` and the description when present (whitespace collapsed)
  - [7] location
  - [9] salesName or `''`
  - [10] `crewLine`
  - [2], [8] and [11] are `''`
  - the row's `punctuality` is set

- [ ] **Step 1: Write the failing test.** Use real values from the 2026-11-11 data pull:

```ts
const owl: SheetJob = { id: 'owl', date: '2026-11-11', date_end: '2026-11-11', time_start: '11:00:00', time_end: '18:00:00',
  punctuality: 'flexible', project_title: 'OWL OPTICS PTE LTD - VISUAL REFRESH FW2026', client: 'Luxottica',
  description: 'VISUAL  REFRESH\n(CONFIRMED)', location: '9 KING ALBERT PARK #01-51/52 KAP MALL', client_poc_name: 'Li Min',
  client_poc_phone: '9123 4567', salesName: 'Nicholas',
  crew: { drivers: [{ name: 'CK', you: false }], support: [{ name: 'Razu', you: false }], externals: [] } }
const prism = { ...owl, id: 'prism', date: '2026-11-12', date_end: null, time_start: '16:00:00', time_end: null, punctuality: 'strict' as const,
  project_title: 'PRISM+ Tech Show Sticker Installation', description: null, client_poc_phone: null,
  crew: { drivers: [{ name: 'Xiao Yi', you: false }], support: [{ name: 'Zhang Xing', you: false }, { name: 'Hai Long', you: false }], externals: [{ name: 'Ah Seng Signs', you: false }] } }
const tree = { ...owl, id: 'tree', date: '2026-11-12', date_end: null, time_start: null, time_end: null, project_title: 'Christmas Tree installation' }
const giga = { ...owl, id: 'giga', date: '2026-11-15', date_end: '2026-11-16', time_start: '22:00:00', time_end: '03:00:00', project_title: 'Giga Teardown' }
const hsbc = { ...owl, id: 'hsbc', date: '2026-11-12', date_end: null, time_start: '23:45:00', time_end: '05:00:00', project_title: null, client: 'sam bilt' }
const leaves = [{ name: 'Cara', date_start: '2026-11-07', date_end: '2026-11-16' }, { name: 'Vinz', date_start: '2026-11-09', date_end: '2026-11-11' }]

check('columns', SHEET_COLUMNS.length, 12)
check('time range', sheetTime('11:00:00', '18:00:00'), '11:00 AM - 6:00 PM')
check('time start only', sheetTime('16:00:00', null), '4:00 PM')
check('time past midnight', sheetTime('23:45:00', '05:00:00'), '11:45 PM - 5:00 AM')
check('time midnight', sheetTime('00:00', null), '12:00 AM')
check('no time', sheetTime(null, null), '')
check('crew order drivers+support+externals', crewLine(prism.crew), 'Xiao Yi+Zhang Xing+Hai Long+Ah Seng Signs')
check('week ok (Monday)', parseWeek('2026-11-09'), '2026-11-09')
check('week not Monday', parseWeek('2026-11-10'), null)
check('week not a date', parseWeek('2026-02-30'), null)
check('week junk', parseWeek(['2026-11-09']), null)

const rows = buildWeekRows('2026-11-09', [hsbc, giga, prism, owl, tree], leaves)
check('every row has 12 cells', rows.every(r => r.cells.length === 12), true)
check('7 day rows', rows.filter(r => r.type === 'day').map(r => r.cells[0] + ' ' + r.cells[1]),
  ['9-Nov Mon', '10-Nov Tue', '11-Nov Wed', '12-Nov Thu', '13-Nov Fri', '14-Nov Sat', '15-Nov Sun'])
check('Mon: gap, day, leave', rows.slice(0, 3).map(r => r.type), ['gap', 'day', 'leave'])
check('Mon leave line', rows[2].cells[6], 'On leave: Cara, Vinz')
const wed = rows.findIndex(r => r.type === 'day' && r.cells[0] === '11-Nov')
check('Owl row', rows[wed + 2].cells, ['', '', '', 'Li Min\n9123 4567', 'Flexible', '11:00 AM - 6:00 PM',
  'OWL OPTICS PTE LTD - VISUAL REFRESH FW2026\nVISUAL REFRESH (CONFIRMED)', '9 KING ALBERT PARK #01-51/52 KAP MALL', '', 'Nicholas', 'CK+Razu', ''])
const thu = rows.findIndex(r => r.type === 'day' && r.cells[0] === '12-Nov')
check('Thu order: untimed, 4pm, 11:45pm', rows.slice(thu + 1, thu + 5).map(r => r.type === 'job' ? r.cells[6].split('\n')[0] : r.type),
  ['leave', 'Christmas Tree installation', 'PRISM+ Tech Show Sticker Installation', 'sam bilt'])
check('strict flag', rows[thu + 3].punctuality, 'strict')
check('Giga on Sun 15', rows.some(r => r.type === 'job' && r.cells[6].startsWith('Giga Teardown')), true)
const next = buildWeekRows('2026-11-16', [giga], [])
check('Giga also on Mon 16', next.filter(r => r.type === 'job').length, 1)
check('no leave row when nobody is off', next.some(r => r.type === 'leave'), false)
```

- [ ] **Step 2: Run it and watch it fail.** `npx tsx src/lib/utils/jobsheet-rows.test.ts` → FAIL, module not found.
- [ ] **Step 3: Implement `src/lib/utils/jobsheet-rows.ts`** to those signatures and rules. Use UTC date maths, as in `all-jobs.ts`.
- [ ] **Step 4: Run it and watch it pass.** All ✓, exit 0.
- [ ] **Step 5: Commit** `feat(jobsheet): week rows for the old Google Sheet (pure)`.

---

### Task 2: The private link (key, data, route)

**Files:**
- Create: `src/lib/utils/jobsheet-key.ts`, with test `src/lib/utils/jobsheet-key.test.ts`
- Create: `src/lib/supabase/queries/jobsheet.ts`
- Create: `src/app/api/sheet/jobs/route.ts`

**Interfaces:**
- Consumes: Task 1 (`buildWeekRows`, `parseWeek`, `SHEET_COLUMNS`, `SheetJob`, `SheetLeave`); `getCrewForJobs(jobIds, null)` from `src/lib/supabase/queries/crew-names.ts`; `createServiceClient`.
- Produces:
  - `newSheetKey(): string`: 32 random bytes as base64url (node `crypto`)
  - `keysMatch(given: unknown, stored: string | null): boolean`: constant time (`timingSafeEqual` on equal-length buffers); false for a non-string, an empty string or a null stored key
  - `SHEET_KEY_SETTING = 'jobsheet_link_key'`
  - `sheetLink(appUrl: string, key: string): string` → `${appUrl}/api/sheet/jobs?key=${key}`
  - `getSheetKey(svc): Promise<string | null>` and `setSheetKey(svc, key: string, by: string): Promise<void>`, which upsert `app_settings`, as `setRetention` does in `src/lib/supabase/queries/job-bin.ts`
  - `getWeekSheet(svc, monday: string): Promise<{ jobs: SheetJob[]; leaves: SheetLeave[] }>`:
    - jobs: `status = 'scheduled'`, `date <= sunday`, and (`date_end >= monday` or `date >= monday`)
    - sales names from a follow-up `users` read by id (standing rule: never embed users onto jobs in a PostgREST select)
    - crew from `getCrewForJobs`
    - leaves: `user_leaves` overlapping the week (`date_start <= sunday`, `date_end >= monday`), names from a follow-up `users` read, users with `deleted_at` set left out
  - `GET /api/sheet/jobs?key=…&week=YYYY-MM-DD`:
    1. Wrong or missing key → `404` with body `Not found`.
    2. Bad week → `400` `{ error: 'bad_week' }`.
    3. Otherwise 200 `{ week, columns: SHEET_COLUMNS, rows }`, with `Cache-Control: no-store`.

    The key check runs FIRST, before any parsing that could tell a stranger anything. `src/middleware.ts` already skips `/api/*`.

- [ ] **Step 1: Write the failing key test** `src/lib/utils/jobsheet-key.test.ts`:

```ts
const k = newSheetKey()
check('key length (32 bytes base64url)', k.length, 43)
check('key is url-safe', /^[A-Za-z0-9_-]+$/.test(k), true)
check('two keys differ', newSheetKey() !== k, true)
check('match', keysMatch(k, k), true)
check('wrong key', keysMatch(k.slice(0, -1) + (k.endsWith('A') ? 'B' : 'A'), k), false)
check('different length', keysMatch(k + 'x', k), false)
check('missing', keysMatch(undefined, k), false)
check('empty', keysMatch('', k), false)
check('nothing stored', keysMatch(k, null), false)
check('link', sheetLink('https://greenqubes-ops.vercel.app', 'abc'), 'https://greenqubes-ops.vercel.app/api/sheet/jobs?key=abc')
```

- [ ] **Step 2: Run it and watch it fail** (module not found). **Step 3: Implement** `jobsheet-key.ts`. **Step 4: Run it and watch it pass.**
- [ ] **Step 5: Write** `queries/jobsheet.ts` and the route.
- [ ] **Step 6: Real-data check, read-only.** A throwaway `npx tsx --env-file=.env.local` script in the plan workspace (not committed) calls `getWeekSheet` + `buildWeekRows` for `2026-11-09` and prints each row's type and its first 60 characters. Expected: rows match the approved preview. That means:
  - "On leave: Cara, Daniel Siew, Vinz" on 9 Nov
  - the three Luxottica visual refreshes on Wed 11 with "CK+Razu"
  - Giga Teardown on Sun 15

  Do NOT print phone numbers: mask the Contact Person cell in the printout.
- [ ] **Step 7:** `npx tsc --noEmit` clean; `npm run build` lists `/api/sheet/jobs`; full suite `fails=0`.
- [ ] **Step 8: Commit** `feat(jobsheet): private week link for the old Google Sheet`.

---

### Task 3: Admin → Settings: show, copy and change the link

**Files:**
- Create: `src/app/api/admin/jobsheet-link/route.ts`
- Modify: `src/features/admin/SettingsTab.tsx` (a second `Card` below "Bin")

**Interfaces:**
- Consumes: Task 2 (`getSheetKey`, `setSheetKey`, `newSheetKey`, `sheetLink`). Copy the admin guard from `src/app/api/admin/settings/route.ts` (`guardAdmin`, real role).
- Produces:
  - `GET /api/admin/jobsheet-link` → `{ link: string | null }`
  - `POST /api/admin/jobsheet-link` → makes and stores a new key, returns `{ link }`. The old key dies at once.
  - Both answer 403 for anyone but the real admin.
  - App URL: `process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'`, the same fallback the rest of the app uses. The preview shares the database, so the link always points at production. Google can't reach previews anyway (SSO).

**The card ("Old jobsheet (Google Sheet)"):**
- No link yet: one sentence explaining what it is, and a **Make link** button.
- With a link: the full link as selectable text (`break-all`), a **Copy** button, and a **Change link** button.
  - **Copy** uses `navigator.clipboard.writeText` inside the click. If that is refused, select the text instead.
  - **Change link** opens an in-card confirm: "The old link stops working straight away. Paste the new one into the sheet's script (Greenqubes menu → Set app link)." with Change and Cancel.
- Below: a "How to set it up" list of the 5 steps from the spec's setup guide. The script file to paste is `scripts/google-sheet/jobsheet-sync.gs` on GitHub; show its URL on the `main` branch as plain text with a link.

- [ ] **Step 1:** Write the route. Then add the card using the existing `Card` and `Btn`, matching the Bin card's look.
- [ ] **Step 2:** `npx tsc --noEmit` clean; `npm run build` passes; full suite `fails=0`.
- [ ] **Step 3: Commit** `feat(jobsheet): admin can make, copy and change the sheet link`.

---

### Task 4: The script inside the sheet

**Files:**
- Create: `scripts/google-sheet/jobsheet-sync.gs`
- Test: `scripts/google-sheet/jobsheet-sync.test.ts`. It loads the `.gs` text into `vm.createContext({})` with `vm.runInContext`, then calls the functions off the context. Top-level code must only define functions and constants, never touch `SpreadsheetApp` at load.
- Create: `docs/google-sheet-jobsheet-setup.md`, a plain-language guide for Nic, the same 5 steps as the card.

**Interfaces (pure, tested):**
- `weekOfTab(name: string, todayISO: string): string | null`
  - Matches `^\s*(\d{1,2})/(\d{1,2})\s*to\s*(\d{1,2})/(\d{1,2})\s*$`, case-insensitive.
  - Reads the END date and picks its year from (today's year −1, 0, +1) as the one nearest today.
  - Returns the Monday (`YYYY-MM-DD`) of the week holding that end date.
  - null for anything else.
- `tabNameFor(monday: string, spaced: boolean): string` → `'30/11 to6/12'`, or `'30/11 to 6/12'` when spaced.
- `isSpaced(name: string): boolean`: whether the newest tab writes "to 6/12" or "to6/12".
- `findMarker(colA: string[]): number`: row index (0-based) of the one cell containing `FROM THE APP`. `-1` if none, `-2` if more than one.
- `MARKER_TEXT = "FROM THE APP · fills itself every hour · don't type below this line"`

**Apps Script parts** (not unit-tested; checked in Task 5):
- `onOpen()` adds a **Greenqubes** menu with three items: Set app link, Refresh now, Set up hourly refresh.
- **Set app link** prompts for the link and stores it in `PropertiesService.getScriptProperties()` as `APP_LINK`.
- **Set up hourly refresh** deletes this project's existing triggers, then makes one `refreshAll` trigger, `everyHours(1)`. Running it twice can never double up.
- `refreshAll()`:
  1. Today = `Utilities.formatDate(new Date(), 'Asia/Singapore', 'yyyy-MM-dd')`.
  2. Make sure next week's tab exists. Next week = this week's Monday + 7. If no tab maps to it, copy the newest weekly tab, delete rows 3 onwards from the copy, name it `tabNameFor(nextMonday, isSpaced(newest.getName()))`, and place it right after the newest.
  3. Then, for every tab whose `weekOfTab` Monday + 6 ≥ today:
     - fetch `APP_LINK + '&week=' + monday` (`muteHttpExceptions: true`); skip the tab unless 200 and JSON with `rows`
     - `findMarker` on column A: `-2` → skip; `-1` → put the marker at last row + 2
     - clear contents and formats of all rows below the marker
     - write the rows to columns A–L
     - format: `gap` rows grey `#cfcfcf`; `leave` rows red text; `job` rows' Punctuality cell `#f4cccc`/`#990000` (strict) or `#cfe2f3`/`#0b5394` (flexible); wrap text on
  4. The marker row is formatted yellow `#fff2cc`, bold, and merged across A–L.
  5. One tab's failure never stops the others: try/catch per tab, logged with `console.log`.

- [ ] **Step 1: Write the failing test** `scripts/google-sheet/jobsheet-sync.test.ts`:

```ts
check('normal tab',                 g.weekOfTab('9/11 to15/11', '2026-11-11'), '2026-11-09')
check('spaced tab',                 g.weekOfTab('14/9 to 20/9', '2026-11-11'), '2026-09-14')
check('Sunday-start typo → end week', g.weekOfTab('22/11 to29/11', '2026-11-11'), '2026-11-23')
check('year turn, in Dec',          g.weekOfTab('28/12 to3/1', '2026-12-30'), '2026-12-28')
check('year turn, in Jan',          g.weekOfTab('28/12 to3/1', '2027-01-02'), '2026-12-28')
check('not a week tab',             g.weekOfTab('Sheet1', '2026-11-11'), null)
check('From the app tab ignored',   g.weekOfTab('From the app', '2026-11-11'), null)
check('name unspaced',              g.tabNameFor('2026-11-30', false), '30/11 to6/12')
check('name spaced',                g.tabNameFor('2026-11-30', true), '30/11 to 6/12')
check('spaced?',                    [g.isSpaced('14/9 to 20/9'), g.isSpaced('9/11 to15/11')], [true, false])
check('marker none',                g.findMarker(['Date', '', 'x']), -1)
check('marker found',               g.findMarker(['Date', 'y', g.MARKER_TEXT, '']), 2)
check('two markers',                g.findMarker([g.MARKER_TEXT, 'a', g.MARKER_TEXT]), -2)
```

- [ ] **Step 2: Run it and watch it fail** (the file doesn't exist). **Step 3: Write** `jobsheet-sync.gs`. **Step 4: Run it and watch it pass.**
- [ ] **Step 5:** Write `docs/google-sheet-jobsheet-setup.md` in plain language: what it does, the 5 steps, Google's "allow" screen ("Google hasn't verified this app" is normal for your own script: Advanced → Go to …), how to change the link, and "don't type below the yellow bar".
- [ ] **Step 6:** Full suite `fails=0`. **Commit** `feat(jobsheet): the script that fills the old sheet's weekly tabs`.

---

### Task 5: Try it on a copy of the real sheet (with Nic, after push)

No code. Once dev is pushed and production holds the link route (it only works from production: previews sit behind Vercel SSO), Nic does the following:

- [ ] Make the link in Admin → Settings.
- [ ] In Google Sheets: File → Make a copy of "Greenqubes Jobs". Open the copy, then Extensions → Apps Script. Paste the script, run **Set app link** and **Refresh now**, and allow it.
- [ ] Check:
  - this week's and next week's tabs have the yellow bar and the jobs under it
  - typed rows above are untouched
  - next week's tab exists with the right name
  - **Set up hourly refresh** is on
- [ ] Only then repeat the steps on the real sheet.
