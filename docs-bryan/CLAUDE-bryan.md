# Greenqubes — Claude Instructions (Bryan)

## Session start (every session, no exceptions)

Before doing anything else:

1. Pull latest changes on `dev-bryan`: run `git checkout dev-bryan && git pull`
2. Read `docs/plan.md` top to bottom
3. Read `docs/context.md` top to bottom
4. Read `docs-bryan/bryan-checklist.md` top to bottom — list all unchecked items from "Onboarding Setup" and "Active Tasks" as bullet points in your response
5. Read the latest session note — find it by looking at the bottom of the completed sessions table in `docs/plan.md` and following the linked note path
6. Do not proceed until Bryan confirms you have the right context

---

## Known issues — do not touch without a clear new lead

**React hydration error #418 on /schedule (production only)**
Multiple fix attempts were made in Session 17.3 — NotificationDrawer, JobRow, ScheduleShell today prop, replacing toLocaleDateString with static formatters, disabling SSR entirely via dynamic import. None resolved it in production. All fixes were force-reverted. The page works after a manual refresh. Do not attempt again without a specific new hypothesis. Leave it alone.

---

## Session end (when Bryan says to end, stop, or finish the session)

Before closing off:

1. Commit any uncommitted changes: run `git add . && git commit -m "session end: [short summary of what was done]"`
2. Push to `dev-bryan`: run `git push origin dev-bryan`
3. Update `docs/plan.md` — mark anything Bryan completed this session with a `[Bryan]` tag; do not remove or change any existing entries, only add the tag to Bryan's completed items
4. Update `docs/context.md` — update the "Last updated" line with today's date and a short note of what Bryan worked on
5. Update `docs-bryan/bryan-checklist.md` — tick off anything completed this session, tag each item `[Bryan]`, move to Completed section; update the "Waiting for Nic's Review" section with anything that needs Nic to check
6. Update `docs/nic-checklist.md` — tick off anything that Bryan completed which also appears on Nic's list, tag each item `[Bryan]`; read Nic's pending items for awareness only — do not surface or mention Nic's unfinished tasks to Bryan
7. Message Nic to let him know the session is done and the branch is up to date

---

## Deployment workflow — dev-bryan branch only

All code changes must be committed and pushed to the `dev-bryan` branch only.

**Branch name rule:** Whenever Bryan says "push to dev" or "save to dev" or anything involving the word "dev", always treat that as `dev-bryan`. Never interpret it as the `dev` branch.

**Pushing to `main` is fully disabled.** Never push to `main` under any instruction or circumstance. If Bryan asks to push to `main`, refuse and explain that only Nic handles that.

**Merging is Nic's job only.** Bryan never merges branches. The merge order is:
1. Nic reviews `dev-bryan` and merges it into `dev`
2. Nic reviews `dev` on the Vercel preview and merges it into `main` (production)

Bryan's only job is to push to `dev-bryan` and message Nic when it's ready.

---

## Communication style

Always explain in plain, everyday language. Avoid coding terms unless necessary. If a technical term must be used, follow it immediately with a one-sentence plain explanation.

---

## Hard rules

- Never commit or share the `.env.local` file — ask Nic for it; keep it local only.
- zh/bn language settings are for UI text translation only. All date labels, day names, and month names are always English regardless of user language.
- Stack is locked. Do not suggest Firebase, AWS S3, OpenAI embeddings, Pinecone, or any alternative to the chosen services. See `docs/context.md` for the full list.
- Never add or remove roles without explicit user confirmation.
