# fix-prealphabugs — Session Note
_2026-05-13_

---

## What was done

Pre-alpha hotfix session. Worked through all pending bugs and quick UI fixes from the pre-alpha test (2026-05-11). Also settled two Group G config items.

---

## Group G — Manual config

### `NEXT_PUBLIC_APP_URL` in Vercel
Added `NEXT_PUBLIC_APP_URL=https://greenqubes-ops.vercel.app` to all three Vercel environments (Production, Preview, Development). Unblocks "View in app →" links in Telegram notifications.

### Session timeout
Free Supabase tier doesn't allow configuring session timebox. Keeping sessions as forever. Revisit if/when upgrading to paid tier.

---

## Group A — Notification bugs

### Submit / approve / send-back don't fire
Not a code bug. All three routes are correct. Root cause: seed data users (Sarah, Kai, Ravi, Ali) have no `telegram_chat_id` set, so the `.filter(s => s.telegram_chat_id)` drops all recipients silently and returns `{ ok: true }`. Will work once real users have their TG IDs set via Admin → Users tab.

### Overdue cron never fires
Two bugs:
1. The cron entry was **missing from `vercel.json`** — the route comment claimed it was wired but it wasn't.
2. Manual `GET /api/notifications/overdue` requires `Authorization: Bearer <CRON_SECRET>` header; browser requests return 403.

**Fix:** Added cron entry to `vercel.json`:
```json
{ "path": "/api/notifications/overdue", "schedule": "0 */2 * * *" }
```
Now auto-runs every 2 hours in production. Manual test: `curl -H "Authorization: Bearer <CRON_SECRET>" https://greenqubes-ops.vercel.app/api/notifications/overdue`

---

## Group B — Bug report fails when image attached

**Root cause:** Browser-side `fetch(url, { method: 'PUT' })` to an R2 presigned URL triggers a CORS preflight. R2 bucket had no CORS config → browser threw `TypeError` → outer catch showed "Failed to submit bug report."

**Fixes:**
1. Nic configured CORS on the R2 bucket: `GET + PUT` allowed from `https://greenqubes-ops.vercel.app`, `https://*.vercel.app`, `http://localhost:3000`.
2. Wrapped the screenshot upload in `try/catch` in `BugReportButton.tsx` so the report submits without a screenshot if the upload fails for any reason.

---

## Group C — Voice note mic permission every time

**Root cause:** `handleRecord` in `ChatSection.tsx` called `navigator.mediaDevices.getUserMedia({ audio: true })` fresh on every recording, then stopped all tracks on `recorder.onstop`. iOS Safari re-prompts on every new `getUserMedia` call after tracks are released.

**Fix:** Added `streamRef = useRef<MediaStream | null>(null)`. Stream is requested once on first press, stored in `streamRef`, reused for all subsequent recordings. Tracks stopped only on component unmount via `useEffect` cleanup.

---

## Group D — Job chat attachment has no handler

Two issues:
1. **CORS** — same R2 issue as Group B, resolved by CORS config.
2. **No Telegram notification** — file attachments were inserted directly into Supabase client-side, bypassing the messages API route. Voice notes notify; attachments didn't.

**Fix:** Added `kind: 'attachment'` handler to `messages/route.ts` — sends a Telegram notification with `📎 {filename}` preview using the existing `tplJobMessage` template. `ChatSection.handleFileChange` now calls the messages route after the file insert.

---

## Group E — Quick UI fixes

### Admin back arrow
Added `ArrowLeft` + `Link href="/schedule"` to `AdminShell.tsx` header. Sits left of the "Greenqubes / Admin" title block.

### Role name capitalisation
- `Pill.tsx`: label values changed from `'sales'`, `'scheduler'`, `'installer'` → `'Sales'`, `'Scheduler'`, `'Installer'`
- `UserMenu.tsx`: role override chip (amber pill) got `capitalize` CSS class
- `UsersTab.tsx`: both role `<select>` dropdowns now render `r.charAt(0).toUpperCase() + r.slice(1)` for option labels
- DB enum values unchanged

### `time_end` + `description` optional
Removed `rules={req}` / `register('description', req)` from both fields in `CoreSection.tsx`. Both are now always optional regardless of `validateRequired` prop. Error display removed from `time_end` and `description` Fields.

### Time fields persist on edit
After a successful save in `JobDetailShell.tsx`, `reset(values)` is now called before `router.refresh()`. This syncs react-hook-form's baseline with the saved values, making `isDirty` false after save and preventing field drift on subsequent refreshes.

---

## Key files changed

- `vercel.json` — added overdue cron
- `src/app/api/jobs/[id]/messages/route.ts` — `kind: 'attachment'` notification handler
- `src/components/BugReportButton.tsx` — screenshot upload hardened
- `src/components/Pill.tsx` — role label capitalisation
- `src/components/UserMenu.tsx` — override chip capitalisation
- `src/features/admin/AdminShell.tsx` — back arrow
- `src/features/admin/UsersTab.tsx` — role option capitalisation
- `src/features/job-detail/ChatSection.tsx` — stream reuse, attachment notification call
- `src/features/job-detail/CoreSection.tsx` — time_end + description optional
- `src/features/job-detail/JobDetailShell.tsx` — reset after save

---

## Commits

- `7623fab` fix: pre-alpha hotfixes — notifications, uploads, voice mic, form fields

---

## What's next

**Group F — Features needing design discussion:**
- Admin role (4th role for `ai@greenqubes.com`) — discuss scope + RLS before implementing; CLAUDE.md rule update needed first
- AI "Suggest" button per text field (Project Title, Description, Note, Production Instructions)
- Scheduler: send scheduled job back to sales
- Scheduler: delete job (hard delete + confirmation modal)
- Sales: "Recall Job" copy (same mechanic as send-back, clearer label)
- Sales: pre-send popup with scheduler load indicator
- Voice note: live audio waveform while recording
