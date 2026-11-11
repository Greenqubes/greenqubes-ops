# Job gallery, bulk move back, job groups and the sheet link: design

_Date: 2026-11-11. Agreed with Nic in chat, piece by piece, against two mockup pages:_
- _Gallery: https://claude.ai/artifact/16wyY3Dj8AoZMCR2KFeu4a (version 3)_
- _Groups and bulk move: https://claude.ai/artifact/CWJsUZBEiF3kvSmcAzr9qs (version 1)_

_Local sources: `.superpowers/mockups/job-gallery-mockups.html` and `.superpowers/mockups/jobs-tab-groups-mockups.html` (gitignored)._

Four independent pieces, one document. Each can be built, reviewed and shipped
on its own. "Nic" marks what he decided. "My call" marks what I decided in
his place; he saw every one of them in chat and did not object.

**Build order (my call):** 1. Bulk move back, 2. Sheet link, 3. Gallery,
4. Groups. The two small pieces go first so the team gets something
quickly. Groups goes last because it reshapes the same list the bulk move
adds buttons to.

---

## Part 1: Moving jobs back in bulk

### Why
Nic pushed 22 near-identical jobs ("Deliver Oakley & RB A4 Tentcard - <store>")
into To arrange too early. Each one can be sent back from its own card
today, but not twenty at once.

### What Nic decided
- On the Jobs tab, tick several jobs and move them back one stage together:
  - **To arrange → Ongoing**, for sales.
  - **Ongoing → Drafts**.
- The rules are exactly those for moving one job at a time. Jobs that can't
  move stay ticked, with the reason shown. The rest move.

### How it maps onto what exists
- The Jobs tab is `src/features/stages/StageListShell.tsx`. It already has
  tick boxes and a bulk Delete (`canBulkDelete`, `selected`, `bulkDelete`).
  Today the tick boxes appear only where bulk delete is allowed, and never on
  To arrange.
- **To arrange → Ongoing** is the per-job `pull_back` arrange action
  (`POST /api/jobs/[id]/arrange`, sales side, `canArrange` /
  `isArrangeSalesSide` in `src/lib/utils/arrange-rules.ts`). It is the action
  behind "Not ready, back to Ongoing" and "Back to Ongoing" on `ArrangeCard`.
- **Ongoing → Drafts** is `POST /api/jobs/[id]/stage` with `{ to: 'draft' }`,
  checked by `canMoveStage` and `stageMoveBlocked` in
  `src/lib/utils/job-stage-rules.ts`:
  - Schedulers may move only their own jobs to Drafts.
  - Admin is tested with the real flag.
  - A job with designers on it is refused.
- Neither action sends Telegram. **But `pull_back` puts a bell card in every
  scheduler's bell** (`pullBack` → `alertSchedulers` in
  `src/lib/arrange/actions.ts`: "Back to Ongoing: <title>", bell only).
  Ongoing → Drafts sends nothing. Found by the builder check.
- **My call:** a bulk "Back to Ongoing" sends **one** bell card per
  scheduler for the whole batch, for example "Back to Ongoing: 18 jobs".
  Name the group, or the first title "and 17 more", and the sales person.
  It does not send one card per job: 22 cards would bury everything else in
  the bell. A single-job pull back keeps its own card as today. This needs
  either a "quiet" flag on the per-job path, with the batch card sent once
  at the end, or a bulk endpoint that calls the same rule functions. Either
  is fine.

### My calls
- Bulk calls the same per-job server routes once per ticked job, so every
  rule stays in one place. A new bulk endpoint is acceptable only if it calls
  the same rule functions. It must read every response, as `bulkDelete`
  already does: failures stay ticked, successes leave the list.
- When something fails, a summary says how many moved and how many didn't,
  with a reason per job ("Designer still on this job", "Not your job",
  "No connection"). Use the error codes the routes already return
  (`not_permitted`, `invalid_move`, and the `stageMoveBlocked` codes).
- The button shows on the list where it applies:
  - "Back to Ongoing" on To arrange.
  - "Back to Drafts" on Ongoing.
  - Tick boxes show for anyone who can use at least one action on that list.
    Delete keeps its own `canBulkDelete` rule.

### Anti-goals
- No new way to move a job forward in bulk. Pushing to schedule stays one
  job at a time, with its clash check.
- No change to who may move which job.

---

## Part 2: Scheduled jobs into Nic's old Google Sheet (in-sheet script)

### Why
During the switch-over some of the team still read, and type into, the old
"Greenqubes Jobs" Google Sheet. It has one tab per week, named like
"9/11 to15/11", "14/9 to 20/9" or "28/12 to3/1" (spacing varies). Nic wants
the app's scheduled jobs to show up there by themselves.

Preview with real data: https://claude.ai/artifact/MZfiqDKVS4SVdjFDvTU24L
(option 2 is the one chosen).

### What Nic decided
- **One way only:** app → sheet. Jobs typed into the old sheet stay there.
  The app never reads them, and nothing ever overwrites them.
- **An Apps Script inside his Google Sheet does the writing**
  (Extensions → Apps Script, Google's own tool, running as Nic). It fetches
  from a private app link.
  - Considered and rejected:
    - A Claude-run copy through a Google connector: costs usage, updates less
      often, is less exact.
    - The app writing through Google's API: a new vendor and service account.
    - A plain `IMPORTDATA` formula in one "From the app" tab with a week box:
      it can't create tabs, and means two places to look each week.
  - The app itself never talks to Google. The script pulls.
- **Each weekly tab gets the app's jobs in a block at the bottom,** under a
  yellow bar reading "FROM THE APP · fills itself every hour · don't type
  below this line". Rows typed above the bar are never touched.
- **Next week's tab is created automatically,** with his naming pattern.
- **Contact numbers are included.**
- Files and photos do not come across. Only text.
- The layout follows his columns. App jobs sit in their own block, not mixed
  into his day sections. Mixing would risk moving rows people are typing.

### The app side: a private JSON link
- `GET` route, unauthenticated, protected by a long random secret
  (`?key=`). `src/middleware.ts` already skips `/api/*`, so the route checks
  the secret itself. Compare it in constant time. A wrong or missing secret
  gets a plain 404. It takes `?week=YYYY-MM-DD` (a Monday) and returns that
  week, Monday to Sunday.
- **My call:** the secret lives in `app_settings` (migration 0063 table), not
  an env var. **Admin → Settings** shows the link with a copy button and a
  **Change link** button: a new secret, and the old one dies at once, with no
  redeploy. Admin only. After changing it, the new link is pasted into the
  script's settings (setup guide below).
- It reads with the service key. The secret is the whole gate. Read only
  what the rows need.
- **It returns rows ready to write,** so the layout logic lives in the repo
  as a pure, tested function and the script stays thin:
  - shape: `{ week, rows: [{ type: 'gap' | 'day' | 'leave' | 'job', cells: string[12], punctuality?: 'strict' | 'flexible' }] }`
  - for each day, in order: a grey `gap` row, a `day` row, then an optional
    `leave` row, then that day's `job` rows

  All seven days are listed, even with no jobs.
- **Which jobs:** `status = 'scheduled'` only (never drafts, ongoing or
  completed). A multi-day job (`date_end`) gets a row on each day it covers.
  Within a day, jobs are sorted by start time, untimed first (matching the
  installer lists).
- **The 12 columns, in the sheet's order:**
  1. **Date:** "11-Nov".
  2. **Day:** "Wed".
  3. **Production:** blank.
  4. **Contact Person:** client contact name and number.
  5. **Punctuality:** "Strict" or "Flexible".
  6. **Time:** "11:00 AM - 6:00 PM", or the start time alone.
  7. **Jobs Description:** title, a line break, then the description.
  8. **Location / Sites:** the full address.
  9. **DO:** blank.
  10. **PIC:** the job's sales person. Checked against real data on
      2026-11-11: his PIC names (Nicholas, Charles, Vinz, Daniel, Wei Qing)
      are the app's sales people.
  11. **Remarks:** crew, drivers then support then externals, joined with
      "+" ("CK+Razu").
  12. **Job Time:** blank.
- Dates and day names are always English (hard rule).
- **Leave line (my call):** "On leave: A, B", names only, never the type or
  note (RLS-locked to HR/admin, 0058). Leave is already shown to every role.
  A half day counts as on leave for that day.
- Crew names come from `getCrewForJobs`
  (`src/lib/supabase/queries/crew-names.ts`).

### The script (a deliverable kept in the repo)
- **Where it lives:** a plain-text `.gs` file in the repo, under a folder
  such as `scripts/google-sheet/`. It is the source of truth: Nic pastes it
  into Extensions → Apps Script once, and again if it changes.
- **The link lives in the script's own settings** (Script Properties), never
  in a cell. People who only view the sheet can't see it.
- **Hourly trigger:** for every weekly tab whose week ends today or later
  (Singapore date):
  1. Find the marker bar.
  2. Clear everything below it.
  3. Write that week's rows and apply formatting:
     - grey gap rows
     - red text on leave rows
     - red fill for Strict, blue for Flexible in the Punctuality cell

  Past weeks are no longer refreshed, so they keep their last state as a
  record.
- **First time on a tab with no marker:** put the bar two rows below the
  last used row.
- **Weekly trigger (Monday):** if next week's tab doesn't exist, create it.
  Name it with the newest tab's pattern, copy only the header rows from the
  newest weekly tab, then add the bar and the rows.
- **Reading tab names:** parse the start "D/M" from names like
  "9/11 to15/11", "14/9 to 20/9" and "28/12 to3/1". Infer the year as the one
  that puts the date nearest today, which handles the December–January turn.
  Ignore tabs that don't match the pattern.
- **Safety:**
  - The script only ever writes below its own marker, or into a tab it
    created.
  - If a tab has more than one marker, or the fetch fails, it changes
    nothing on that tab. A failed hour just leaves the last good data.
- Built and tested on **a copy of Nic's sheet** (File → Make a copy) before
  it goes near the real one.

### Setup guide for Nic (deliverable)
A short plain-language guide, linked from the Admin → Settings card:
1. Open the sheet and go to Extensions → Apps Script.
2. Paste the script in.
3. Paste the link into its settings.
4. Run "Set up" once. Google asks him to allow it; the guide explains that
   screen.
5. To change the link later: press Change link in the app, then paste the
   new one into the script's settings.

### Anti-goals
- The app never calls Google.
- Nothing reads typed rows, and nothing writes above the marker.
- Never include prices.
- Never include drafts. Pending privacy (0062) must not leak through this
  side door.

---

## Part 3: The job gallery

### Why
A photo sent in the job chat can only be downloaded, never just viewed
(`FileAttachment` in `src/features/job-detail/ChatSection.tsx` has only a
download button). A job's pictures and files are also scattered across five
places: chat, the Files folders, the design brief, the production / signed
DO / completion photo sections, and voice notes in chat. Nic wants one
WhatsApp-style gallery.

### Where it lives (Nic)
- **Phone:** a fifth tab, **Gallery**, after Chat, in `JobFormLayout`
  (`src/features/job-detail/JobFormLayout.tsx`; `JobTab` and `TABS` gain
  `'gallery'`).
- **Computer (lg+):** a Gallery section below the job chat, in the right
  column.
- On a new, unsaved job it is greyed out like Chat. `NewJobShell` passes
  `lockedTabs`.
- For HR (`isReadOnlyOfficeRole`, where Chat is hidden): the gallery shows,
  without any chat items. My call.

### What it holds (Nic): three views on a Media | Docs | Links switch, each with a count
- **Media:** photos, videos and voice notes in a grid, newest first, grouped
  by day ("Today", "Mon 9 Nov", then "October 2026" for older months).
  - Each tile has a small corner mark for where it came from: Chat, Files,
    Design brief, Production, Completion, Signed DO.
  - Videos show a play mark and their length.
  - Voice notes are a green tile with a waveform and their length.
  - Filter chips: All, Chat, Voice notes, Files, Completion, Signed DO.
    Show only chips that have items.
- **Docs:** every other file (PDF, Excel, Word, design files…), listed with
  name, source, who added it and when, newest first, grouped by day.
  - PDFs open inside the app. Everything else downloads.
- **Links:** the saved web links (`kind = 'url_link'`, `url_text`), opening
  in a new tab as the Files folders do.

### The full-screen viewer (Nic: guesses approved)
- Opens on tapping any Media item.
- Swipe left and right through the current filtered Media list. Pinch to zoom.
- Videos play in place. Voice notes play with a big play button.
- Top: who added it, its source, and its date and time, plus "5 of 24".
- Bottom: a strip of neighbouring items. Buttons: **Download**,
  **Go to message** (chat items only: closes the viewer and scrolls the chat
  to it), and **Delete** (below).
- **Tapping a photo in the chat opens this same viewer** at that photo, in
  place of today's download-only behaviour. The download button stays.
- **Chat albums (Nic):** 4 or more images sent by the same person in a row,
  within 2 minutes of each other (my numbers, WhatsApp's behaviour), show as
  one 2×2 block with "+N" on the last tile. Tapping opens the viewer.
- **Hard rule:** the viewer is a full-screen overlay at `z-[60]` or higher,
  above BottomNav (`z-50`). The existing `src/components/ImageLightbox.tsx`
  sits at `z-50` and must not be reused as it is.
- No emoji anywhere. Icons are stroke-only SVG (lucide), as in the rest of
  the app.

### Where the items come from
- `files` rows for the job:
  - chat attachments: `kind = 'attachment'`, no `bucket_id`
  - folder files: `bucket_id` set
  - `design_brief`, `production_instructions`, `do`, `completion`,
    `url_link`, `photo`, `external_verification`
- **Voice notes:** `messages` with `kind = 'voice'` and `voice_url` (an R2
  key), plus any `files` of `kind = 'voice'`.
- Media or Doc is decided by file type, matching the chat's existing
  `fileKind` helper. Completion uploads may be video (`upload-rules.ts`).
- **Who sees what (my call, no new access): the gallery follows the job
  page, not just the database.** The builder check found the page is
  stricter than RLS in places, and the stricter rule wins:
  - **Installers get the gallery,** showing what their job page shows. That
    means no design-brief files: installers never see the Design brief card
    (`{!isInstaller && <DesignBriefSection/>}`), though RLS 0024 would let
    them read those rows.
  - **Production** is view-only on Files folders. **Designers** are
    view-only on production, signed DO and completion photos
    (`ProductionReadySection`). **Sales and coordinators who don't share an
    Ongoing job** have locked Files (`pendingLocks`). None of them get
    "Delete for everyone" in the gallery where their page gives them no
    delete today.
  - **The server must match.** `DELETE /api/files/[id]` is tightened to the
    same stricter rule, so the API can't do what the screen forbids. One
    pure rule function is shared by the page sections, the gallery and the
    route. Today these roles can delete through the API but not on screen,
    so tightening it removes no working feature.
  - Reads use the viewer's own session, so RLS still holds underneath.
- **Signed links:** the existing `/api/r2/download-url` checks job
  visibility, but it only signs keys that have a `files` row (or a bug
  screenshot). **Voice notes have no `files` row** (they live only in
  `messages.voice_url`), so the route answers 404 and the chat's
  `VoicePlayer` silently does nothing. That has been true since the
  2026-08-13 access fix (`6828f08`). The live database holds **zero voice
  notes** (checked 2026-11-11, read-only), so nobody has been affected. This
  build fixes it: the route also signs a key that matches a
  `messages.voice_url`, after checking the caller can read that message
  (session client, same RLS as the chat).
- **New items appear without a refresh (my call):** reuse the realtime
  subscriptions the job page already has for `files` and `messages`.
- **Loading (my call):** the app stores no thumbnails, so tiles load the
  full image only when scrolled into view (lazy loading). Do not sign URLs
  for the whole grid up front. A batch-signing route is welcome if it keeps
  `/api/r2/download-url`'s permission check. No thumbnail generation in this
  build.

### Deleting (Nic: WhatsApp's "Delete for me" and "Delete for everyone")
- The viewer has a Delete button. The Media grid and the Docs list have a
  **Select** mode to tick several items and delete them together.
- Every delete asks first, in the app's own dialog (not the browser's):
  "Delete 3 files?" with **Delete for me**, **Delete for everyone** (only
  when allowed for every ticked item, otherwise only for the allowed ones,
  saying so), and Cancel.
- **Delete for me:**
  - Anyone, on anything they can see.
  - Hides the item from that person's own gallery and chat only. Everyone
    else is unaffected.
  - It does **not** hide it from the Files folders or the
    production / signed DO / completion sections, which are the job's record
    (my call).
  - Needs a small new per-person hidden-items table: user + file or message.
    RLS: each person reads and writes only their own rows.
- **Delete for everyone, by source:**
  - **Files-folder items, design brief, production, signed DO and completion:**
    exactly today's rules: `canManageJobFiles`, `canDeleteJobFile`,
    `canFixAfterCompletion` in `src/lib/storage/job-file-permissions.ts`,
    enforced by `DELETE /api/files/[id]`. That includes the 24-hour window,
    the last-completion-photo rule and the completed-job locks.
  - **Chat photos, files and voice notes:** new (Nic). Allowed for:
    - the person who sent it
    - schedulers
    - admin (real admin flag)

    Everyone else gets only Delete for me. My call: on a completed job, chat
    items can no longer be deleted for everyone, matching how attachments
    lock on completion. Delete for me still works.
  - Deleting a chat item for everyone removes the stored file (R2) and
    leaves a grey line in the chat where it was: **"Photo deleted by
    <name>"** ("Voice note…" / "File…" by type). The line is permanent and
    visible to everyone.
- The server enforces every rule. The screen only hides what the server
  would refuse.

### Anti-goals
- No new access: nobody sees a file they couldn't already see.
- No moving or renaming from the gallery. That stays in Files.
- No change to how uploads work.
- Voice notes are not transcribed.

---

## Part 4: Job groups on the Jobs tab

### Why
Campaigns produce many near-identical jobs, one per store. Nic wants to fold
them into one row: "a simple grouping method", with drag-in as a nice extra.
A far bigger version (Workflow V3 "project containers": shared details,
files, timings and schedule folding) was cancelled on 2026-09-04 because
demo feedback changed the plan. **Do not build from the V3 spec or reuse its
design.**

### What Nic decided
- **Groups are shared:** everyone looking at the Jobs tab sees the same jobs
  folded the same way.
- **Only the Jobs tab changes.** The schedule, the My jobs side panel and the
  job page are untouched.
- **Making a group:** tick jobs, tap **Group**, name it.
- **Adding later:**
  - On a computer, drag a job onto a group.
  - On a phone, tick it and choose **Add to group**.
- Approved from the mockup:
  - A folded group row with name, shared company and sales person (when all
    its jobs share them), and a count.
  - Tap to open.
  - **Rename** and **Ungroup** inside an open group.

### My calls (shown to Nic, approved)
- **Name auto-fill:** the name fills itself from the start the ticked titles
  share, cut back to the last " - " or word boundary ("Deliver Oakley & RB A4
  Tentcard"). It is editable.
- **Inside an open group,** each job shows only the rest of its title after
  the group name ("Eyechamp NEX"). If a title doesn't start with the name,
  show the whole title.
- **Ticking a group row** ticks every job in it on that list.
- **Who can change groups:** sales, coordinator, scheduler and admin can
  make, rename, ungroup, add and remove. Designers, production and HR see
  groups but cannot change them.
- **One job, one group.** Ungroup only unfolds; it never deletes a job.
  Removing a job: drag it out, or tick it and choose **Remove from group**.
- **Lists:** a group appears in every list (Drafts, Ongoing, To arrange)
  holding only that list's jobs. Inside To arrange it appears in each
  sub-section ("Needs a date", "Offered", …) with only that section's jobs.
  A group with no jobs in a list doesn't show there.
- **Jobs keep their group** as they move stages. A scheduled job leaves the
  Jobs tab as today. A group whose jobs are all scheduled, completed or
  deleted simply stops showing.
- **Drafts stay private:** a group shows only the jobs the viewer can
  already see (RLS 0062). The count is of those. The group row reveals
  nothing about hidden drafts.
- **Search:** a match on a job inside a group shows the group opened with
  the matching jobs.
- **Where the row sits:** a group sits where its first job would sit in that
  list's normal order.
- **Data:** a new `job_groups` table (id, name, created_by, created_at,
  updated_at) plus a nullable `jobs.group_id` with `on delete set null`.
  - **Do not reuse** `job_projects` / `jobs.project_id` from migration 0051.
    That table carries the cancelled V3 meaning (client, timings,
    punctuality, file ownership), and reuse would make the code read as V3.
    0051 stays applied and untouched.
- **Writes** go through a server route that:
  1. checks the role,
  2. checks the caller can see every job involved (session client), and
  3. then writes. Use the service key if jobs' UPDATE RLS would otherwise
     refuse grouping someone else's job.

  Grouping changes no other job field.
- **Duplicate (Nic):** a duplicated job lands in the same group as the one
  it was copied from. The duplicate route copies a fixed list of fields, so
  `group_id` is added to it. The copy starts as the duplicator's private
  Draft as always. Other people's view of the group doesn't include it until
  they can see it (RLS 0062), so the group never reveals a private draft.

### Anti-goals
- No shared details, files, timings or punctuality on a group.
- No grouping on the schedule.
- No nesting.
- No creating jobs inside a group.
- A group never changes who can see a job.

---

## Global constraints (every part)

- **Migrations:** claim numbers at implementation time. Run
  `npx -y supabase@2 migration list` (CLI v3 breaks on this repo), check every
  branch's `supabase/migrations/`, and take the next number above both. This
  document deliberately names none.
  - Expected migrations:
    - Gallery: the per-person hidden-items table, plus whatever the chat
      "deleted" line needs.
    - Groups: `job_groups` and `jobs.group_id`.
    - Sheet: the `app_settings` row.
  - Every new `public` table must, in the same file:
    - grant select, insert, update, delete to `authenticated` and
      `service_role` (never `anon`)
    - enable RLS with policies
- **Database before code:** apply migrations before deploying code that reads
  new columns.
- **i18n:** every new UI string goes in `en.ts` and `zh.ts`. `bn.ts` gets the
  English text (bn is frozen). Dates and day names are always English.
- **Overlays:** `z-[60]` or above: the viewer, delete dialogs, the group-name
  dialog.
- **No emoji** in UI or icons.
- **Tests:** standalone `npx tsx file.test.ts` with a `check()` helper, as in
  the rest of the repo. Pure rules go in `src/lib/utils/*` with tests:
  - who may delete what, for everyone
  - album grouping
  - Media / Doc classification
  - group-name auto-fill
  - sheet row building, and the script's tab-name parsing (the parser is
    pure enough to test in the repo too)
  - bulk-move result sorting
- **Verify with real data, not fixtures:**
  - Run the sheet link against the real schedule, then the script on a copy
    of Nic's real sheet, before shipping.
  - Open the gallery on a real job with chat photos, PDFs and completion
    video. The live database has no voice notes yet, so record one on the
    preview.

## Left to the builder
- Swipe and zoom: a small lightbox library or hand-built. Any library must
  load from npm, not an outside service.
- How PDFs render in the app. Android Chrome cannot show a PDF inside a page
  on its own, so a client-side reader such as pdf.js is expected. That is a
  library, not a new vendor.
- How the chat's "deleted" line is stored (a tombstone on the row versus a
  system message), as long as it survives a refresh and shows the deleter's
  name.
- Drag-and-drop mechanics, keyboard and touch fallbacks.
- Signed-URL expiry handling in a long-open gallery.
- Exact wording of messages, keeping the app's plain tone.
