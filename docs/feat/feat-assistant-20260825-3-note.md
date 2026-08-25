---
session: feat-assistant-3 (Assistant upgrade Phase 3 — chat attachments → pending job)
date: 2026-08-25
branch: dev → main (smoke test passed, merged same day — live on production)
---

# Assistant Upgrade Phase 3 — SHIPPED

> Spec: [../superpowers/specs/2026-08-24-assistant-upgrade-design.md](../superpowers/specs/2026-08-24-assistant-upgrade-design.md)
> Plan: [../superpowers/plans/2026-08-25-assistant-upgrade-phase3.md](../superpowers/plans/2026-08-25-assistant-upgrade-phase3.md)
> **No migration.** Phase 4 (Projects) is the last one — migration **0047** must be db-pushed BEFORE its code.

## What shipped

**Chat attachments (Assistant page only)**
- New pure module `src/lib/ai/attachments.ts` (+25-check standalone test): caps
  (≤5 files / ≤20 MB per message, images ≤5 MB, PDFs ≤15 MB), mime allowlist
  (jpg/png/webp/gif + PDF — **HEIC rejected**: the Anthropic API cannot read
  it, and converting would need a new dependency; spec deviation, Nic OK),
  `isOwnScratchKey` ownership guard, `attachmentNote` (ids for the model).
- Composer + button live: hidden `accept`-filtered input → chips above the
  textarea (uploading = pulsing, × removes) → signed PUT via new
  `/api/assistant/upload-url` to R2 scratch `asst-chat/{userId}/{uuid}.{ext}`.
  Scratch objects are NEVER `files` rows (bucket-leak lessons). Send blocks
  while uploads are in flight; files-only messages allowed.
- Chat route: messages with attachments become content-block arrays — base64
  image/document blocks first (`getObjectBase64`, capped), then the text +
  attachment id note. Every key is checked against the caller's own prefix —
  forged keys are silently dropped. A scratch object deleted by the cleanup
  cron degrades to a "[no longer available]" text note, never an error.
- Floating bubble unchanged (no paperclip) except the job chip below.

**`create_pending_job` — the ONE action**
- Tool #7 in `tool-schemas.ts` (`JOB_BUCKETS` const exported; status key
  `creating` → "Creating the job…" i18n'd en+zh). `executeTool` gained a
  `ToolContext` param: `{ userId, role (effective), attachments map }`.
- Role gate: sales/scheduler/coordinator/admin via `getEffectiveRole`
  (non-previewing admin resolves to scheduler — same as the Duplicate route);
  other roles get an `ok()` refusal (not is_error) so the model relays it
  politely and doesn't retry.
- Executor `queries/assistant-create-job.ts` runs on the **user-scoped
  client** — RLS is the enforcement, exactly the browser New Job form's
  rules. Mirrors NewJobShell: pending status, strict punctuality, POC =
  requester, `['role:sales','role:scheduler']` visibility, the 4 default
  buckets. Attachments are R2 `copyObject`-copied into the job's folder and
  inserted as `files` rows in the model-chosen bucket (default OTHERS).
- Confirm-first is system-prompt enforced (SYSTEM_PREFIX rewritten: "exactly
  ONE action" + protocol bullet; still frozen/byte-stable). Pending is the
  second safety net — the tool cannot set any other status. No Telegram.
- Success → SSE `{type:'job_created', id, title}` → tappable chip
  (`/jobs/{id}`) in BOTH chat surfaces; persisted in saved msgs jsonb along
  with attachment metadata, so reloaded history keeps chips.

**Move file between buckets (job form)**
- `PATCH /api/files/[id]` `{bucketId}` — `files` has NO UPDATE RLS policy
  (confirmed 0002/0019/0024), so the route mirrors the delete-fix pattern:
  role+status via `canManageJobFiles`, target bucket must be on the same job,
  service-client one-column update. R2 object never moves.
- `MoveFileModal` at z-[60]; FolderInput icon on every file row (URL links
  too); state re-homes the file only on server success.

**Scratch cleanup cron**
- `/api/cron/asst-scratch-cleanup` daily 03:00 SGT (`0 19 * * *`): paginated
  `listObjects('asst-chat/')`, deletes objects >30 days old, writes an
  `events` breadcrumb (`asst_scratch_cleanup`). Built this session instead of
  deferred — Nic's pick at session start.

**Verification** — attachments suite new (25 checks); all 8 repo suites
green; type-check + production build green before push.

## Nic's decisions this session

- Tagger: skipped, no changes (session start).
- Scratch cleanup: include in this session (closes the deferred item).
- Inline execution (no subagents) — same as Phase 2.
- HEIC rejection accepted (API limitation; phones send JPEG in practice).
- Smoke: tests 1/2/5/6 passed on the preview (phone). Test 3 (installer
  refusal) folded into the deferred production checks. Test 4 (unsupported
  file → red toast) pending on PC — Android's picker filters those files out
  before selection, so the message can't be triggered there. In checklist.
- Word/Excel/PPTX question → two future checklist items: filing-only Office
  attachments (small) and Office-file text extraction (needs a new
  dependency — explicit OK required, stack locked).

## Facts worth keeping

- **`en.ts` already had `attachFiles`** ('Attach Files', Files section) — a
  duplicate key in the assistant section broke type-check; the existing key
  is reused. zh.ts never had it, so the zh assistant-section addition stands
  (zh may be partial — `t()` falls back per key).
- `chat.msgs` (Json) needs `as unknown as T[]` — a direct cast to a typed
  array fails strict TS.
- The old send path re-appended `{role:'user', content:text}` after slicing
  history — attachments forced a rewrite to send `history` as-is (it already
  ends with the user message once streaming bubbles are filtered out).
- Anthropic media types: image blocks accept only jpeg/png/webp/gif; document
  blocks only PDF. Base64 inflates ~4/3 against the 32 MB request cap — hence
  the 20 MB per-message total.
- Save route needed NO changes: extra fields (attachments, jobCard) ride
  through the `{role, content}[]` cast into msgs jsonb untouched.
- Stop-button edge: an empty streamed bubble is dropped UNLESS it carries a
  jobCard (filter extended).

## ⚠️ Next session

- **Phase 4 — Projects** (the last phase): `asst_projects` +
  `asst_chats.project_id` + `asst_project_files` — **migration 0047, db push
  BEFORE code push**. Folder grouping in sidebar/drawer, per-project
  instructions + files in the cached prefix, project-scoped memory first.
- After Phase 4: the deferred production checks (real installer login ×
  unassigned job; two-account isolation; installer create-job refusal).
- Nic to run smoke test 4 on PC (checklist item).
