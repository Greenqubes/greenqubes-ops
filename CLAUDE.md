# Greenqubes — Claude Instructions

## Session start (every session, no exceptions)

Before doing anything else:

1. Read `docs/plan.md` top to bottom
2. Read `docs/context.md` top to bottom
3. Read `docs/nic-checklist.md` top to bottom — list all unchecked items from "Before Pre-Alpha Testing" and "Before Go-Live" as bullet points in your response
4. **Ask Nic which session note to read** — do not auto-search for one. Wait for Nic to name the file, then read it.
5. Do not proceed until Nic confirms you have the right context

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
4. Read `docs/session-naming.md`, pick the best prefix + topic for what was done this session, and **confirm the filename with Nic before creating the note file**

---

## Deployment workflow — dev branch first

All code changes must be committed and pushed to the `dev` branch first. Vercel will generate a preview deployment automatically. Only after the preview is confirmed working should changes be merged into `main` (production). Never push untested changes directly to `main`.

---

## Hard rules

- zh/bn language settings are for UI text translation only. All date labels, day names, and month names are always English regardless of user language.
- Stack is locked. Do not suggest Firebase, AWS S3, OpenAI embeddings, Pinecone, or any alternative to the chosen services. See `docs/context.md` for the full list.
