# Greenqubes — Claude Instructions

## Session start (every session, no exceptions)

Before doing anything else:

1. Read `docs/plan.md` top to bottom
2. Read `docs/context.md` top to bottom
3. List all files matching `docs/*-note.md`, sort them, identify the most recent one (highest session number / sub-number), read it top to bottom
4. **Confirm to the user** which note file you read and ask: "Is this the latest session note, or is there a newer one I should read first?"
5. Do not proceed until the user confirms

---

## Known issues — do not touch without a clear new lead

**React hydration error #418 on /schedule (production only)**
Multiple fix attempts were made in Session 17.3 — NotificationDrawer, JobRow, ScheduleShell today prop, replacing toLocaleDateString with static formatters, disabling SSR entirely via dynamic import. None resolved it in production. All fixes were force-reverted. The page works after a manual refresh. Do not attempt again without a specific new hypothesis. Leave it alone.

---

## Deployment workflow — dev branch first

All code changes must be committed and pushed to the `dev` branch first. Vercel will generate a preview deployment automatically. Only after the preview is confirmed working should changes be merged into `main` (production). Never push untested changes directly to `main`.

---

## Hard rules

- Sessions 18 and 18.X are reserved for visual design work AND additional feature implementations needed before pre-alpha testing. No unrelated refactoring. New functional bugs found during 18.X go to Session 17.X.
- zh/bn language settings are for UI text translation only. All date labels, day names, and month names are always English regardless of user language.
- Stack is locked. Do not suggest Firebase, AWS S3, OpenAI embeddings, Pinecone, or any alternative to the chosen services. See `docs/context.md` for the full list.
- Bug-fix and maintenance sessions before Session 19 are named 17.X (17.1, 17.2, 17.3 …). Sessions 18 and 18.X are reserved for design work and pre-alpha feature work only.
