# Job Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every job a WhatsApp-style Gallery: a fifth tab on phone, and a section below the chat on a computer. It has Media / Docs / Links views, a full-screen swipe viewer, chat photos that open in that viewer, chat albums, and Delete for me / Delete for everyone.

**Architecture:**
- **Pure, tested rules** decide three things:
  1. what the gallery holds and how it is grouped (`src/lib/utils/gallery.ts`)
  2. who may delete what for everyone (`src/lib/storage/gallery-delete.ts`), one function shared by the screen and the server
  3. which items stack into chat albums
- **One migration** adds two tables:
  - `job_item_hides`: Delete for me, per person
  - `chat_deletions`: the grey "Photo deleted by …" lines

  Every existing reader of `files` and `messages` is untouched, because deleted rows are still removed as today. Nothing is tombstoned in place.
- **The UI** is a `GallerySection`, a full-screen `MediaViewer` (yet-another-react-lightbox), a `PdfViewer` (pdfjs-dist) and a `DeleteDialog`. `JobFormLayout` gains a `gallery` slot, and `ChatSection` opens photos in the viewer and shows albums, deleted lines and Delete-for-me hides.

**Tech Stack:** Next.js 15, React, Supabase (session + service key, realtime), Cloudflare R2 signed URLs, `yet-another-react-lightbox` (npm, MIT), `pdfjs-dist` (npm). Both are libraries, not services, so the stack lock is respected.

**Spec:** `docs/superpowers/specs/2026-11-11-gallery-groups-bulk-sheet-design.md`, Part 3. Mockups: https://claude.ai/artifact/16wyY3Dj8AoZMCR2KFeu4a (version 3).

## Global Constraints

- **No new access.** The gallery follows the job PAGE, which is stricter than RLS in places:
  - Installers never get design-brief files.
  - HR (`isReadOnlyOfficeRole`) gets no chat items.
  - Reads go through the viewer's own session.
- **Delete for everyone follows today's page rules,** and the server enforces the same pure function:
  - folder files: `canManageJobFiles`, minus production, minus `pendingLocks().files`
  - production / signed DO / completion: `canDeleteJobFile`, minus designers
  - design brief: `designBriefEditable` and the office rule
  - chat photos, files and voice notes (new, per Nic): the sender, schedulers and the real admin, and never on a completed job
- **Delete for me** hides from that person's own gallery and chat only. It never hides from the Files folders or the photo sections.
- **Deleting a chat item for everyone** removes the R2 object and the row, and leaves a permanent grey line: "Photo deleted by <name>" (or "Video…", "File…", "Voice note…").
- **Overlays sit at `z-[70]`:** the viewer, the PDF viewer and the delete dialog. That is above BottomNav (`z-50`) and the job page's own bars. `src/components/ImageLightbox.tsx` (`z-50`) is NOT reused.
- No emoji. Icons are lucide, stroke only.
- **i18n:** every string goes in `en.ts` and `zh.ts`; `bn.ts` gets English. Dates and day names are always English.
- **Migration:** claim the number at implementation time. Run `npx -y supabase@2 migration list`, check every branch's `supabase/migrations/`, and take the next number above both. New `public` tables get, in the same file:
  - `grant select, insert, update, delete … to authenticated` and the same `to service_role`, never `anon`
  - RLS enabled
- **The migration is applied to the shared database before any code that reads it is pushed,** and only with Nic's go-ahead (it changes the live database).
- **No thumbnails are generated.** Tiles sign and load only when scrolled into view.
- **Tests:** standalone `npx tsx` with the repo's `check()` helper.
- Full suite command:
  `bash -c 'fails=0; n=0; for f in $(git ls-files "*.test.ts"); do n=$((n+1)); npx tsx "$f" >/dev/null 2>&1 || { echo "FAIL $f"; fails=$((fails+1)); }; done; echo "files=$n fails=$fails"; [ $fails -eq 0 ]'`

## Review Focus

1. **A role whose page is view-only must get no Delete for everyone anywhere**, in the grid, the viewer or the API: production on folder files, designers on production/DO/completion photos, non-sharers on an Ongoing job, and HR. Test each in `gallery-delete.test.ts`. The route calls the same function.
2. **The last completion photo on a completed job** can be hidden for me but never deleted for everyone. Test.
3. **A chat item deleted for everyone while someone else has the viewer open on it:** their viewer must drop it and move to the next item, not show a broken image. Realtime removes it from the list, and the viewer clamps its index. Pin this with the viewer's `clampIndex` helper test.
4. **Voice notes:** none exist in the live database yet. One recorded on the preview must play in the chat AND in the gallery (the signing route's new voice branch). This is checked in Task 7 on the preview.
5. **A huge job (100+ photos) on mobile data:** no tile may sign or load before it scrolls into view. Pin `visibleKeysToSign` (only keys reported visible, minus ones already signed) in a test.

---

### Task 1: Gallery rules (pure)

**Files:** Create `src/lib/utils/gallery.ts`, test `src/lib/utils/gallery.test.ts`.

**Interfaces (Produces):**
- **`type GallerySource = 'chat' | 'voice' | 'files' | 'design_brief' | 'production' | 'completion' | 'do'`**
  - Map from a `files` row:
    - `bucket_id` set → `files`
    - `kind 'attachment'` with no bucket → `chat`
    - `design_brief` → `design_brief`
    - `production_instructions` → `production`
    - `completion` → `completion`
    - `do` → `do`
    - `photo` and `external_verification` → `files`
    - `url_link` → `files` (Links view)
  - Voice messages → `voice`.
- **`type GalleryKind = 'image' | 'video' | 'voice' | 'pdf' | 'doc' | 'link'`**
- **`mediaKindOf(name: string): 'image' | 'video' | 'pdf' | 'doc'`**, by extension:
  - image: jpg, jpeg, png, gif, webp, heic, heif
  - video: mp4, mov, m4v, webm, 3gp
  - pdf: pdf
  - anything else: doc
- **`type GalleryFile = { id; job_id; kind; bucket_id: string | null; r2_key: string; name: string | null; url_text: string | null; uploader_id: string | null; uploaderName: string | null; ts: string }`**
- **`type GalleryVoice = { id; author_id: string | null; authorName: string | null; voice_url: string; ts: string }`**
- **`type GalleryItem = { key: string; fileId?: string; messageId?: string; source: GallerySource; kind: GalleryKind; fileKind: string | null; name: string; r2Key: string | null; url: string | null; byId: string | null; by: string | null; ts: string }`**
  - `key` is `'f:'+id` or `'m:'+id`.
  - `name` falls back to the last part of `r2_key`.
- **`buildGallery(input: { files: GalleryFile[]; voices: GalleryVoice[]; hiddenFiles: Set<string>; hiddenMessages: Set<string>; show: { chat: boolean; designBrief: boolean } }): { media: GalleryItem[]; docs: GalleryItem[]; links: GalleryItem[] }`**
  - Newest first.
  - Media holds image, video and voice; Docs holds pdf and doc; Links holds url_link.
  - Hidden items are dropped.
  - `show.chat` false drops `chat` and `voice`; `show.designBrief` false drops `design_brief`.
- **`chipsFor(media: GalleryItem[]): Array<'chat' | 'voice' | 'files' | 'completion' | 'do'>`**: in that order, only the chips with items.
- **`dayLabel(tsISO: string, todayISO: string): string`**, using the Singapore date of `ts`:
  - same day → `'Today'`
  - same month and year → `'Mon 9 Nov'`
  - earlier → `'October 2026'`
- **`groupByDay(items, todayISO): Array<{ label: string; items: GalleryItem[] }>`**: in input order, consecutive items with the same label grouped together.
- **`chatAlbums(items: Array<{ key: string; isImage: boolean; byId: string | null; ts: string }>): string[][]`**: runs of 4 or more consecutive images by the same person, each within 2 minutes of the one before. Returns each run's keys in order.
- **`clampIndex(index: number, length: number): number`**: for the viewer when items vanish. 0 when the list is empty.
- **`visibleKeysToSign(visible: string[], signed: Set<string>): string[]`**

- [ ] **Step 1: Write the failing test** with these exact cases:
  - **`mediaKindOf`:**
    - `IMG_4021.JPG` → image
    - `site.heic` → image
    - `walk.MOV` → video
    - `DO.pdf` → pdf
    - `list.xlsx` → doc
    - `noext` → doc
  - **`buildGallery`** on a fixture with, in time order:
    - a chat photo (no bucket), a folder PDF, a completion video, a design-brief image, a url_link and a voice note
    - with `hiddenFiles` holding the folder PDF's id

    Expect:
    - media = [voice, design-brief image, completion video, chat photo] (newest first)
    - docs = []
    - links = [the link]
    - with `show.chat=false` → media loses the voice note and the chat photo
    - with `show.designBrief=false` → it loses the design-brief image
  - **`chipsFor`** on that media → `['chat','voice','completion']`. A design brief has no chip.
  - **`dayLabel`:**
    - `('2026-11-11T05:00:00Z','2026-11-11')` → `'Today'`
    - `('2026-11-08T17:30:00Z','2026-11-11')` → `'Mon 9 Nov'` (Singapore date)
    - `('2026-10-02T03:00:00Z','2026-11-11')` → `'October 2026'`
  - **`chatAlbums`:**
    - 5 images by A at 00:00, 00:30, 01:10, 02:00, 03:30 (minutes:seconds) → one album of 5
    - 3 images → `[]`
    - 4 images with a 3-minute gap after the 2nd → `[]`
    - images by A, A, B, A, A, A, A → one album of the last 4
  - **`clampIndex`:** `(5, 5)` → 4; `(2, 0)` → 0; `(-1, 3)` → 0.
  - **`visibleKeysToSign`:** `(['a','b','c'], new Set(['b']))` → `['a','c']`.
- [ ] **Step 2: Run it and watch it fail.** **Step 3: Implement.** **Step 4: Run it and watch it pass.** **Step 5: Commit** `feat(gallery): what the gallery holds, grouped by day (pure)`.

---

### Task 2: Who may delete for everyone (pure, shared by screen and server)

**Files:** Create `src/lib/storage/gallery-delete.ts`, test `src/lib/storage/gallery-delete.test.ts`.

**Interfaces:**
- Consumes: `canManageJobFiles`, `canDeleteJobFile` (`src/lib/storage/job-file-permissions.ts`); `GallerySource` (Task 1).
- Produces:
  - `type DeleteForEveryoneInput = { role: Role; isAdmin: boolean; viewerId: string; source: GallerySource; fileKind: string | null; byId: string | null; jobStatus: string | null; completedAt: string | null; otherCompletionFiles: number; filesLocked: boolean; designBriefEditable: boolean; now?: number }`
    - `role` is the EFFECTIVE role; `isAdmin` is the real flag.
    - `filesLocked` is `pendingLocks({...}).files`, as the page computes it.
    - `designBriefEditable` is `designBriefEditable({ status, readOnly: formReadOnly })`, as the page passes it.
  - `canDeleteForEveryone(input): boolean`:
    - **chat / voice:** `jobStatus !== 'completed' && (byId === viewerId || role === 'scheduler' || isAdmin)`
    - **files:** `canManageJobFiles(role, jobStatus).allowed && role !== 'production' && !filesLocked`
    - **design_brief:** `designBriefEditable && role !== 'installer' && canManageJobFiles(role, jobStatus).allowed`
    - **production / completion / do:** `role !== 'designer' && canDeleteJobFile({ role, jobStatus, completedAt, fileKind, otherCompletionFiles, now }).allowed`

- [ ] **Step 1: Write the failing test.** The base is a sales viewer `u1` on a scheduled job, `filesLocked: false`, `designBriefEditable: true`. Each case changes one field:

  | case | expected |
  |---|---|
  | chat photo by `u1` | true |
  | chat photo by `u2`, viewer is sales | false |
  | chat photo by `u2`, viewer is scheduler | true |
  | chat photo by `u2`, viewer reads scheduler with `isAdmin` | true |
  | chat photo by `u1`, job completed | false |
  | installer `u3`'s own chat photo, viewer `u3` installer | true |
  | voice by `u1` | true |
  | folder file, sales | true |
  | folder file, production | false |
  | folder file, sales with `filesLocked: true` | false |
  | folder file, installer | false |
  | folder file, hr | false |
  | folder file, completed job | false |
  | completion photo, designer | false |
  | completion photo, installer, open job | true |
  | completion photo, sales, completed job, `otherCompletionFiles: 0` | false (the last one) |
  | completion photo, sales, completed job, `otherCompletionFiles: 1` | true (fix after completion) |
  | production photo, production role | true |
  | design brief, sales, `designBriefEditable: false` | false |
  | design brief, installer | false |
- [ ] **Steps 2–4:** RED → implement → GREEN. **Step 5: Commit** `feat(gallery): one delete-for-everyone rule for screen and server (pure)`.

---

### Task 3: Database, signing and the delete routes

**Files:**
- Create: `supabase/migrations/<N>_gallery_hides_and_chat_deletions.sql`
- Modify: `src/app/api/files/[id]/route.ts` (DELETE uses `canDeleteForEveryone`; a chat attachment also writes a `chat_deletions` row)
- Create: `src/app/api/jobs/[id]/messages/[messageId]/route.ts` (DELETE, voice notes only)
- Create: `src/app/api/gallery/hide/route.ts` (POST)
- Modify: `src/app/api/r2/download-url/route.ts` (sign voice keys)
- Modify: `src/lib/utils/bin-rules.ts` (or wherever `BIN_CHILD_TABLES` lives: add `chat_deletions`, so a binned and restored job keeps its deleted lines)
- Modify: the `Database` types, if hand-maintained (`src/lib/supabase/types.ts`)

**The migration:**
- **`job_item_hides`**
  - Columns: `id uuid pk default gen_random_uuid()`; `user_id uuid not null references users(id) on delete cascade`; `file_id uuid references files(id) on delete cascade`; `message_id uuid references messages(id) on delete cascade`; `created_at timestamptz not null default now()`.
  - Constraints: `check ((file_id is null) <> (message_id is null))`, `unique (user_id, file_id)`, `unique (user_id, message_id)`.
  - RLS: select, insert and delete only where `user_id = get_my_id()`.
- **`chat_deletions`**
  - Columns: `id uuid pk default gen_random_uuid()`; `job_id uuid not null references jobs(id) on delete cascade`; `item_kind text not null check (item_kind in ('photo','video','file','voice'))`; `item_ts timestamptz not null` (when the deleted item was sent, so the line sits where it was); `deleted_by uuid references users(id) on delete set null`; `deleted_by_name text not null`; `created_at timestamptz not null default now()`.
  - RLS: SELECT mirrors the CURRENT `messages` SELECT policies. Read them across migrations; 0002 is the start and later files change them. No insert, update or delete policy: the service key writes it.
  - Add it to the realtime publication, the way `messages` was (0008).
- Both tables get the two grants (`authenticated` and `service_role`) in the same file.

**The routes:**
- **`DELETE /api/files/[id]`**
  1. Keep today's order: sign in, then `callerCanSeeJob` on the session client.
  2. Then load what the rule needs: the job's `status, completed_at, created_by, sales_poc_id`, its coordinators and designers, and the file's `bucket_id, uploader_id, name, ts`.
  3. Compute `filesLocked` with `pendingLocks({ stage, canEdit: canEditAtStage(viewer, job), isDesigner })`, and `designBriefEditable` the same way `JobDetailShell` does.
  4. Decide with `canDeleteForEveryone`. A refusal keeps today's 403 messages.
  5. For a chat attachment (`kind 'attachment'`, no bucket), after the delete succeeds, insert `chat_deletions` with `item_kind` from `mediaKindOf(name)`: image → photo, video → video, otherwise file. Use `item_ts = file.ts` and the deleter's name.
- **`DELETE /api/jobs/[id]/messages/[messageId]`**
  - Voice messages only (400 otherwise). The caller must be able to read the message (session client). Decide with `canDeleteForEveryone` (source `voice`).
  - Then, on the service key: delete the R2 object (`voice_url`) first, then the row, then insert `chat_deletions` (`voice`).
- **`POST /api/gallery/hide`**
  - Body: `{ items: Array<{ fileId: string } | { messageId: string }> }`, at most 200.
  - Insert on the caller's SESSION client (RLS: own rows only), ignoring duplicates.
  - `user_id` is taken from the caller's profile, never from the body.
- **`/api/r2/download-url`:** before the final 404, when the key matches a `messages.voice_url` on the caller's SESSION client (RLS decides), sign it.

- [ ] **Step 1: Claim the number.** Run `npx -y supabase@2 migration list`, run `git branch -a`, and check each branch's `supabase/migrations/`. Write the file, and note the number and what was checked in the ledger.
- [ ] **Step 2:** Write the routes. `npx tsc --noEmit` clean.
- [ ] **Step 3:** Full suite `fails=0`; `npm run build` lists the new routes.
- [ ] **Step 4: STOP and ask Nic** before applying the migration to the shared database (`npx -y supabase@2 db push`). It must be live before this code is pushed. Then run `npx -y supabase@2 migration list` and confirm the remote shows `<N>`.
- [ ] **Step 5: Commit** `feat(gallery): hides, deleted-line records, voice signing, and delete routes that follow the page`.

---

### Task 4: The viewer, the PDF reader, the delete dialog

**Files:**
- Create: `src/features/job-detail/gallery/MediaViewer.tsx`, `PdfViewer.tsx` and `DeleteDialog.tsx`
- Create: `src/features/job-detail/gallery/useSignedUrls.ts`, a hook that caches signed URLs per key for 10 minutes and signs only keys passed in by visibility (uses `visibleKeysToSign`)
- Modify: `package.json`: add `yet-another-react-lightbox` and `pdfjs-dist`, the latest versions at least two weeks old. Set up the pdf.js worker the way its Next.js docs say: a bundled worker URL via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`.

**Interfaces:**
- `MediaViewer({ items: GalleryItem[]; startKey: string; open: boolean; onClose(): void; canDelete(item): boolean; onDelete(item): void; onGoToMessage?(item): void; lang })`
  - Full screen at `z-[70]`; swipe, pinch zoom, a video plugin and a thumbnails strip.
  - Top bar: who added it, its source and its time, plus "5 of 24".
  - Buttons: Download (signed with the filename), Go to message (chat items only), and Delete (only when `canDelete` or hide is possible, which is always).
  - Voice items render as a big play button with the item's length.
  - When `items` shrinks while open, the index goes through `clampIndex`.
- `PdfViewer({ item, open, onClose })`: full screen at `z-[70]`; renders the pages to canvas, scrolls, and has a Download button.
- `DeleteDialog({ count, everyoneCount, open, onMe(), onEveryone(), onClose() })`: an in-app dialog at `z-[70]`.
  - Title: "Delete {count} item(s)?"
  - **Delete for me** always.
  - **Delete for everyone** only when `everyoneCount > 0`. When `everyoneCount < count`, add the line "{everyoneCount} of these can be deleted for everyone; the rest only for you."
  - Cancel.

- [ ] **Step 1:** Install the two packages and build the three components and the hook.
- [ ] **Step 2:** `npx tsc --noEmit` clean; `npm run build` passes (pdf.js worker bundling is the usual trap); full suite `fails=0`.
- [ ] **Step 3: Commit** `feat(gallery): full-screen viewer, PDF reader and delete dialog`.

---

### Task 5: The Gallery section and tab

**Files:**
- Create: `src/features/job-detail/gallery/GallerySection.tsx`
- Modify: `src/features/job-detail/JobFormLayout.tsx`
  - `JobTab` adds `'gallery'`, and `TABS` = details, team, files, chat, gallery.
  - New `gallery` slot: on lg+ it sits below `chat` in the right column.
  - It honours `hiddenTabs` and `lockedTabs`.
- Modify: `src/features/job-detail/JobDetailShell.tsx` (passes `gallery`) and `src/features/job-detail/NewJobShell.tsx` (`lockedTabs={['chat','gallery']}`)
- Modify: `src/lib/i18n/en.ts`, `zh.ts` and `bn.ts`

**What `GallerySection` takes:**
- Props: `{ jobId, userId, role, isAdmin, lang, job (status, completed_at, sharers, designers), files: JobFile[], initialVoices, show: { chat: !isReadOnlyRole, designBrief: !isInstaller }, filesLocked, designBriefEditable }`.
- Voices come from the same `messages` the chat loads.
- Hides load from `job_item_hides` (own rows, session client).
- Realtime keeps `files`, `messages`, `chat_deletions` and the person's own hides current, reusing the job page's existing subscriptions where they exist.

**What it shows (mockup):**
- **Top:** a Media / Docs / Links switch with counts.
- **Media:**
  - filter chips (`chipsFor`)
  - day groups (`groupByDay`)
  - a 3-column grid; tiles lazy-sign through `useSignedUrls` with an IntersectionObserver
  - a corner source mark (lucide: MessageSquare, Mic, Folder, PenLine, Factory, CheckCircle2, FileText)
  - videos show a Play mark; voice notes are a green tile with a waveform and their length
- **Docs:** a list showing name, source, who and when. PDF opens `PdfViewer`; anything else downloads.
- **Links:** opens in a new tab.
- **Select mode:**
  - Ticks on tiles and list rows, and a bar with "{n} selected" and Delete.
  - Delete opens `DeleteDialog`. `everyoneCount` comes from `canDeleteForEveryone` per item.
  - **Delete for me** → `POST /api/gallery/hide`.
  - **Delete for everyone** → for each item, `DELETE /api/files/{id}` or `DELETE /api/jobs/{jobId}/messages/{id}`. Failures stay selected with a toast.
- **Empty states:** "No photos or videos yet." / "No documents yet." / "No links yet."

**i18n keys (en | zh):**

| key | en | zh |
|---|---|---|
| `tabGallery` | Gallery | 相册 |
| `galleryMedia` | Media | 媒体 |
| `galleryDocs` | Docs | 文件 |
| `galleryLinks` | Links | 链接 |
| `galleryAll` | All | 全部 |
| `galleryChat` | Chat | 聊天 |
| `galleryVoice` | Voice notes | 语音 |
| `galleryFiles` | Files | 附件 |
| `galleryCompletion` | Completion | 完工照 |
| `galleryDo` | Signed DO | 签收单 |
| `galleryDesignBrief` | Design brief | 设计简报 |
| `galleryProduction` | Production | 生产 |
| `gallerySelect` | Select | 选择 |
| `gallerySelected` | {n} selected | 已选 {n} 项 |
| `galleryDelete` | Delete | 删除 |
| `galleryDeleteTitle` | Delete {n} item(s)? | 删除 {n} 项？ |
| `galleryDeleteForMe` | Delete for me | 仅为我删除 |
| `galleryDeleteForEveryone` | Delete for everyone | 为所有人删除 |
| `galleryDeleteSome` | {e} of these can be deleted for everyone; the rest only for you. | 其中 {e} 项可为所有人删除，其余只能为你删除。 |
| `galleryDownload` | Download | 下载 |
| `galleryGoToMessage` | Go to message | 查看消息 |
| `galleryOf` | {i} of {n} | 第 {i} / {n} 项 |
| `galleryEmptyMedia` | No photos or videos yet. | 还没有照片或视频。 |
| `galleryEmptyDocs` | No documents yet. | 还没有文件。 |
| `galleryEmptyLinks` | No links yet. | 还没有链接。 |
| `galleryToday` | Today | 今天 |
| `chatDeletedPhoto` | Photo deleted by {name} | {name} 删除了照片 |
| `chatDeletedVideo` | Video deleted by {name} | {name} 删除了视频 |
| `chatDeletedFile` | File deleted by {name} | {name} 删除了文件 |
| `chatDeletedVoice` | Voice note deleted by {name} | {name} 删除了语音 |

`galleryToday` replaces the literal "Today" from `dayLabel` when rendering; month and day names stay English.

- [ ] **Step 1:** Build it and wire it in. **Step 2:** tsc, build, full suite. **Step 3: Commit** `feat(gallery): the Gallery tab — Media, Docs, Links, select and delete (Nic)`.

---

### Task 6: The chat uses the viewer, albums, deleted lines and hides

**Files:** Modify `src/features/job-detail/ChatSection.tsx`.

- **A chat image opens** `MediaViewer` over that job's whole Media list (the same `buildGallery` result), starting at the tapped photo.
  - The thumbnail's download button stays.
  - Use one viewer instance shared with the gallery: lift it to `JobDetailShell` through a small context, or a callback prop `onOpenMedia(key)`.
- **Albums:** `chatAlbums` runs render as one 2×2 block, the 4th tile showing "+N" when there are more than 4. Tapping opens the viewer at that photo.
- **Deleted lines:** `chat_deletions` rows for the job render as a centred grey line at `item_ts`, using `chatDeleted*`. They are added to the realtime subscription.
- **Hides:** items in the person's `job_item_hides` are left out of their chat.
- **Go to message:** the viewer's button scrolls the chat to the item (`id={'chat-item-'+key}`) and switches the phone tab to Chat.

- [ ] **Step 1:** Make the changes. **Step 2:** tsc, build, full suite. **Step 3: Commit** `feat(gallery): chat photos open full screen, albums, and deleted lines`.

---

### Task 7: Real-data check on the preview (after Nic says push; the migration is already applied)

- [ ] **On a real job with chat photos, folder PDFs and completion photos:** the Gallery shows them, grouped by day, with the right marks; swipe works on a phone; a PDF opens in the app.
- [ ] **Record a voice note on the preview:** it plays in the chat AND in the gallery.
- [ ] **Delete for me** on a chat photo: it disappears from your chat and gallery only. A second account still sees it.
- [ ] **Delete for everyone** on your own chat photo: the grey "Photo deleted by …" line appears for both accounts.
- [ ] **As production:** no Delete for everyone on folder files.
- [ ] **As an installer:** no design-brief files in the gallery.
