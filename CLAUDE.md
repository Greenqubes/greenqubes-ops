# Greenqubes — Claude Instructions

## Session start (every session, no exceptions)

Before doing anything else:

1. Pull latest changes on `dev`: run `git checkout dev && git pull`
2. Read `docs/plan.md` top to bottom
3. Read `docs/context.md` top to bottom
4. Read `docs/nic-checklist.md` top to bottom — list the unchecked items from the "Pending — Next Session" section as bullet points in your response, grouped by their sub-headings
5. Read the latest session note — find it by looking at the bottom of the completed sessions table in `docs/plan.md` and following the linked note path
6. Ask Nic: "Any updates to the AI importance scoring categories in the tagger? (1–5 scale in `src/lib/ai/tagger.ts`)"
7. Do not proceed until Nic confirms you have the right context

> **Bryan is permanently skipped, both ends of the session (Nic, 2026-09-07).** At session start, do not check `dev-bryan` for unmerged commits and do not merge it. At session end, do not read or update `docs-bryan/bryan-checklist.md`. The branch and that folder both still exist here and on GitHub — leave them alone unless Nic explicitly asks.

---

## Known issues — do not touch without a clear new lead

**React hydration error #418 on /schedule (production only)**
Multiple fix attempts were made in Session 17.3 — NotificationDrawer, JobRow, ScheduleShell today prop, replacing toLocaleDateString with static formatters, disabling SSR entirely via dynamic import. None resolved it in production. All fixes were force-reverted. The page works after a manual refresh. Do not attempt again without a specific new hypothesis. Leave it alone.

---

## Session end (when Nic says to end the session)

Before closing off:

1. Update `docs/plan.md` — mark completed items with `[Nic]` tag, add any new sessions or notes
2. Update `docs/context.md` — update the "Last updated" line and migration plan checkboxes
3. Update `docs/nic-checklist.md` — tick off anything Nic completed this session, tag each item `[Nic]`, add any new pending items
4. **If anything reached `main` this session, write the changelog entry** — add it to `src/lib/changelog/entries.ts` (newest first), then commit and push it with everything else. It is what the team sees in the "What's new" popup, so:
   - **One entry per date, not per push.** If today already has an entry, ADD to it and bump its `time` — never create a second entry for the same date. `date` is what decides whether the popup reopens for someone.
   - `time` is 24-hour `HH:MM` Singapore time; the popup formats it to AM/PM. **Take it from the Vercel PRODUCTION deployment for that release** — open the deployment and read its created time (it shows GMT+8). That is the moment the team could actually see the change, which is what they read the timestamp as. (Nic, 2026-09-09.)
     - **Never compute it with `TZ=Asia/Singapore date`.** This shell has no tzdata, so the `TZ` variable is ignored and the command **silently returns UTC** — it put `07:33` on a release that went live at `15:24`. Plain `date '+%H:%M'` is already correct local (SGT) time if you need a clock reading, but the deployment's own time is the one to use.
     - A time written earlier in the session is stale by the time it ships — set it at merge time, not before.
   - Sections in order, each optional and skipped when empty: `headsUp` (only when something changes how people WORK), `added`, `improved`, `fixed`, `known` (still-open problems).
   - **English only** (Nic, 2026-09-07) — entries are prose and are not translated; the popup's own chrome is.
   - Write from the reader's side of the screen: what changed for THEM, never the code. "Sales can close their own jobs" — not "widened the sales RLS policy". No file names, no migration numbers, no jargon.
   - **One line per item — roughly 8–15 words. Say what changed, then stop.** (Nic, 2026-09-08, after the first entry ran 30–47 words a bullet.) Cut the *why*, the how-to and the reassurance: this is a popup people skim, and anyone who wants the detail opens the screen. The ONE place to spend more words is `headsUp`, where someone has to act differently and a second clause earns its place. If a bullet needs a second sentence, the first sentence is usually too long. The 2026-09-07 entry in `entries.ts` is the worked example.
   - If a change would confuse someone who doesn't read it, it belongs in `headsUp`, not `improved`.
   - Nothing reached `main`? Skip this step silently — do not write an entry for work that only sits on `dev`.
5. Read `docs/session-naming.md`, pick the best prefix + topic, and propose a filepath in the format `docs/{prefix}/{prefix}-{topic}-{YYYYMMDD}-{n}-note.md` — check the relevant `docs/{prefix}/` folder for existing files with the same topic+date and increment `{n}` accordingly — **confirm with Nic before creating the file**

---

## Deployment workflow — dev branch first

All code changes must be committed and pushed to the `dev` branch first. Vercel will generate a preview deployment automatically. Only after the preview is confirmed working should changes be merged into `main` (production). Never push untested changes directly to `main`.

The `feat-job-form-redesign`, `feat-workflow-v2`, and `feat-live-updates` branches are kept for historical record only — do not push new changes to them.

**Workflow V3 (project containers) was CANCELLED 2026-09-04 and its branch DELETED 2026-09-07** (both Nic's calls). Round 1 was built but never merged; rounds 2–3 were dropped. `feat-workflow-v3` is gone from this machine and from GitHub — unlike V2, it was NOT kept as an archive (Nic: "kill this v3 branch"). Its last commit was `5ea130b`; the code is recoverable only from GitHub's deleted-branch grace window or a local reflog, and only if resurrected soon. The spec and plans survive on `dev` under `docs/superpowers/` carrying cancelled banners — do not build from them. Migration `0051_job_projects.sql` stays applied to the shared DB and its file lives on `dev`/`main`: additive, unused by any code, and 0052+ are numbered on top of it — never renumber or drop it.

---

## Communication style

Always explain in plain, everyday language. Avoid coding terms unless necessary. If a technical term must be used, follow it immediately with a one-sentence plain explanation. Nic is a non-technical founder — explanations should be fast to read and easy to understand without a coding background.

---

## Hard rules

- Any overlay UI — modal, drawer, bottom sheet, slide-in panel — must layer **above** the bottom nav, never behind it. BottomNav sits at `z-50`; overlays use `z-[60]` or higher. Nothing interactive may ever be hidden or blocked by the bottom nav. (Nic, 2026-07-22, from Phase 3 smoke test.)
- zh/bn language settings are for UI text translation only. All date labels, day names, and month names are always English regardless of user language.
- Stack is locked. Do not suggest Firebase, AWS S3, OpenAI embeddings, Pinecone, or any alternative to the chosen services. See `docs/context.md` for the full list.
- Never add or remove roles without explicit user confirmation. Claude may suggest new roles but must not implement without approval.
- **Before creating ANY new migration file, claim its number first — no exceptions.** This has gone wrong on six consecutive numbers, because a duplicate is **silently skipped** by `npx supabase db push` with no error at all: the file looks applied, its SQL never runs, and the failure only surfaces later as a missing table or policy. So, in this order, every time:
  1. Run `npx supabase migration list` — the highest `remote` number is what the live DB actually has.
  2. Check **every branch, not just this one** — `git branch -a` then `git ls-tree -r --name-only <branch> -- supabase/migrations/` — because an unmerged branch can have already applied its number to the shared DB.
  3. Take the next number above **both**, and say in your response which number you took and what you checked.

  Two things that follow from this: **never renumber, edit or delete a migration that is already applied** (0051 is the standing example — applied, unused, and later files count on it), and **never reserve numbers in a plan document for work that is not being built yet** — write `<N>` / `<N+1>` and pick the real numbers at implementation time. Reserved numbers go stale and are worse than none. (Nic, 2026-09-07.)
