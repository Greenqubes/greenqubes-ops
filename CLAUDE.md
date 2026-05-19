# Greenqubes — Claude Instructions

## Session start (every session, no exceptions)

Before doing anything else:

1. Read `docs/plan.md` top to bottom
2. Read `docs/context.md` top to bottom
3. Read `docs/nic-checklist.md` top to bottom — list all unchecked items from "Before Pre-Alpha Testing" and "Before Go-Live" as bullet points in your response
4. Read the latest session note — find it by looking at the bottom of the completed sessions table in `docs/plan.md` and following the linked note path
5. Ask Nic: "Any updates to the AI importance scoring categories in the tagger? (1–5 scale in `src/lib/ai/tagger.ts`)"
6. Do not proceed until Nic confirms you have the right context

---

## Known issues — do not touch without a clear new lead

**React hydration error #418 on /schedule (production only)**
Multiple fix attempts were made in Session 17.3 — NotificationDrawer, JobRow, ScheduleShell today prop, replacing toLocaleDateString with static formatters, disabling SSR entirely via dynamic import. None resolved it in production. All fixes were force-reverted. The page works after a manual refresh. Do not attempt again without a specific new hypothesis. Leave it alone.

---

## Session end (when Nic says to end the session)

Before closing off:

1. Update `docs/plan.md` — mark completed items, add any new sessions or notes
2. Update `docs/CONTEXT.md` — update the "Last updated" line and migration plan checkboxes
3. Update `docs/nic-checklist.md` — tick off anything completed this session, add any new pending items
4. Read `docs/session-naming.md`, pick the best prefix + topic, and propose a filepath in the format `docs/{prefix}/{prefix}-{topic}-{YYYYMMDD}-{n}-note.md` — check the relevant `docs/{prefix}/` folder for existing files with the same topic+date and increment `{n}` accordingly — **confirm with Nic before creating the file**

---

## Deployment workflow — dev branch first

All code changes must be committed and pushed to the `dev` branch first. Vercel will generate a preview deployment automatically. Only after the preview is confirmed working should changes be merged into `main` (production). Never push untested changes directly to `main`.

**Exception — job form changes:** Use the `feat-job-form-redesign` branch for any edits to the job form (CoreSection, NewJobShell, JobDetailShell, InstallerGrid, AttachmentBuckets, SearchableSelect, and related files). Push that branch directly to `main` after preview confirmation — do not go through `dev`.

---

## Communication style

Always explain in plain, everyday language. Avoid coding terms unless necessary. If a technical term must be used, follow it immediately with a one-sentence plain explanation. Nic is a non-technical founder — explanations should be fast to read and easy to understand without a coding background.

---

## Hard rules

- zh/bn language settings are for UI text translation only. All date labels, day names, and month names are always English regardless of user language.
- Stack is locked. Do not suggest Firebase, AWS S3, OpenAI embeddings, Pinecone, or any alternative to the chosen services. See `docs/context.md` for the full list.
- Never add or remove roles without explicit user confirmation. Claude may suggest new roles but must not implement without approval.
