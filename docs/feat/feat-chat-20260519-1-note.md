# feat-chat — 2026-05-19

## What was built

### In-app notifications (send-back flow)
- `supabase/migrations/0022_notifications.sql` — new `notifications` table with RLS (users see own only; server can insert for others via service client)
- `src/app/api/notifications/route.ts` — GET (fetch), PATCH (mark read), DELETE (by ids)
- `src/app/api/jobs/[id]/send-back/route.ts` — inserts notification to sales POC using `createServiceClient()` so RLS doesn't block cross-user insert
- `src/features/notifications/NotificationDrawer.tsx` — bell drawer shows send-back reason; mark all read button in header; selective delete with checkboxes + "Delete?(N)" confirm in footer

### Approval page improvements
- `src/lib/supabase/queries/approvals.ts` — added `sales_poc: { id, name }` join to `getApprovalQueue()`
- `src/features/approvals/ApprovalCard.tsx` — "Requested by [name]" shown with UserCircle icon
- `src/features/approvals/SendBackModal.tsx` — Suggest button calls `/api/suggest-grammar`, replaces textarea with corrected text
- `src/app/api/suggest-grammar/route.ts` — Haiku (`claude-haiku-4-5-20251001`), `max_tokens: 512`, returns `{ corrected: string }`

### Wipe send-back messages on approval
- `src/app/api/jobs/[id]/approve/route.ts` — after status update, deletes all `messages` where `body LIKE '[Sent back]%'` for that job

### Chat: WhatsApp-style layout
- `src/features/job-detail/ChatSection.tsx` — own messages right-aligned in terracotta rounded bubble (`rounded-2xl rounded-br-sm`); others left-aligned with avatar + name above; `flex-row-reverse` on own rows; no avatar/name for own messages
- `authorId` added to `ChatItem` type; compared against `userId` prop at render time

### Chat: avatar fix + initials
- `src/lib/supabase/queries/jobs.ts` — **critical bug fix**: `JobMessage.author` renamed to `users`, `JobFile.uploader` renamed to `users` — Supabase join returns data under key `users` (the table name), not the logical alias. This was causing all avatar lookups to return `undefined` → `?`.
- `toItems()` updated: `m.author?.name` → `m.users?.name`, `f.uploader?.name` → `f.users?.name`
- Realtime INSERT handler patched: own messages get `{ ...row, users: { name: userName } }` injected since raw payloads don't include joins
- Avatar helpers (`initials()`, `avatarColor()`) unchanged — just now receive actual names
- Avatar size increased from `w-7 h-7` to `w-9 h-9`, `text-[10px]` → `text-xs`

### Chat: camera capture + file auto-rename
- Camera capture: separate `<input capture="environment">` triggers `handleCameraCapture`; filename = `{username} {date} {time}.{ext}`
- Voice notes: filename = `{username} {date} {time}.webm`
- Regular file attachments: keep original filename (no rename)
- `uploadName(userName, ext)` helper generates the formatted name using `en-SG` locale, `Asia/Singapore` timezone

### Chat: waveform during recording
- `NUM_BARS = 28` bars driven by `AudioContext` + `AnalyserNode`
- Direct DOM updates via `barsRef` (no React re-renders) for smooth 60fps animation
- MM:SS timer via `setInterval`; waveform + timer cleared in `stopWaveform()`

---

## Key files changed

| File | Change |
|---|---|
| `supabase/migrations/0022_notifications.sql` | New — notifications table + RLS |
| `src/app/api/notifications/route.ts` | New — GET/PATCH/DELETE notifications |
| `src/app/api/suggest-grammar/route.ts` | New — Haiku grammar correction |
| `src/app/api/jobs/[id]/send-back/route.ts` | Insert notification to sales POC |
| `src/app/api/jobs/[id]/approve/route.ts` | Wipe [Sent back] messages on approve |
| `src/lib/supabase/queries/jobs.ts` | `author`→`users`, `uploader`→`users` type fix |
| `src/lib/supabase/queries/approvals.ts` | Added `sales_poc` join |
| `src/features/job-detail/ChatSection.tsx` | WhatsApp layout, avatar fix, waveform, camera, rename |
| `src/features/approvals/ApprovalCard.tsx` | Sales POC name shown |
| `src/features/approvals/SendBackModal.tsx` | Grammar suggest button |
| `src/features/notifications/NotificationDrawer.tsx` | Mark all read, selective delete |

---

## Bugs logged for next session

- **[BUG] Job chat realtime not updating** — messages sent by others don't appear live after the refactor. Supabase channel subscription in `ChatSection.tsx` needs investigation.

## Next session priorities

1. Fix job chat realtime (messages not live-updating)
2. Scheduler tab: Send Back button on scheduled jobs
3. Scheduler tab: Delete Job button on job detail
4. Sales tab: rename "Send Back" → "Recall Job" for `awaiting_approval` status
