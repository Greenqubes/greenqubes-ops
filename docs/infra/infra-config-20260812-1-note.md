---
session: infra-config (Obsidian sync outage + knowledge-base restore)
date: 2026-08-12 (work spanned 2026-08-03 → 2026-08-12 in one running session)
branch: dev (+ both script fixes cherry-picked to main, which the server PC pulls)
---

# Obsidian Sync — 57-Day Outage Found, Fixed, and Verified

> The nightly vault sync had been silent since **7 June, 2:30 AM** — 57 days when Nic
> spotted it. Along the way the assistant's knowledge base had quietly shrunk to
> **3 entries**: the supplier pricelists added in the June fix-rag session were gone.
> Everything is now restored, two latent script bugs are fixed with tests, and the
> nightly sync has been verified running unattended for 5+ consecutive nights.

## Diagnosis (from Nic's machine — the server PC is not reachable from here)

1. **`events` table**: nightly `obsidian_sync` rows ran like clockwork through
   `2026-06-06T18:30Z` (= 7 Jun 2:30 AM SGT), then stopped dead. Nothing after.
2. **`kb_chunks`**: only 3 rows, all old paths. The server's vault clone had gone stale
   days *before* the job died, so its last runs walked an outdated vault and deleted the
   DAMA + Jacky Printing pricelist chunks as "stale". The assistant had been unable to
   answer supplier pricing questions since early June — silently.
3. **Root cause of the stop** (established once the server was reachable): the print-server
   role on that PC occasionally hangs → PC restarted → nobody signed back in → both
   nightly tasks were "run only when user is logged on", so they silently never fired.
   The sync revived on 7 Aug when the machine was signed in again, and the underlying
   problem was permanently fixed in the same-day **infra-backup** session
   (`LogonType: Password` on both tasks — they now run unattended).

## Two script bugs fixed (both with standalone tsx test files — no framework needed)

### 1. Frontmatter parser vs Obsidian's properties editor — `scripts/lib/frontmatter.ts`

Obsidian rewrites `visibility:`/`tags:` frontmatter into **multi-line YAML lists**. The old
single-line regex did worse than fall back to defaults: `\s*` consumed the newline and
captured the *next line* as the value, producing garbage visibility tokens like
`"- role:sales"` (matches no role → chunk invisible to everyone) — and in one edge case the
literal text `tags: [x]` as a visibility token. Parser extracted from `obsidian-sync.ts`
into its own module; inline lists, multi-line lists, CRLF, and quoted items all parse
(13 tests: `npx tsx scripts/lib/frontmatter.test.ts`). Supplier costing files are correctly
locked to `role:sales`/`role:scheduler` again.

### 2. Chunker vs CRLF checkouts — `scripts/lib/chunk.ts`

The server PC checks the vault out with Windows line endings, so `\r\n\r\n` paragraph
breaks never matched the `\n\n` split — every file became **one giant chunk** there
(vs 3 on Nic's machine), degrading retrieval and leaving orphaned higher-index rows the
upsert never touched. Chunker normalises line endings first, and the sync now deletes
chunk rows at indexes past the new count (7 tests: `npx tsx scripts/lib/chunk.test.ts`).

Both fixes reached **`main`** the day they were written (the parser fix rode that week's
dev→main merge; the chunker fix was cherry-picked) — the server clone follows `main`, so a
dev-only fix would never reach the machine that runs the sync nightly.

## Vault + knowledge-base changes

- **PTW files locked down** (Nic's call): `COMPANY_PROFILE.md` + `MALLS.md` given
  `visibility: [role:sales, role:scheduler, role:coordinator]` — they had no frontmatter
  and would have synced visible to everyone including installers. No migration needed:
  the `kb_chunks` RLS policy matches `'role:' || get_my_role()` generically.
- **Knowledge base fully restored and verified**: 15 chunks across 10 files; supplier
  pricelists back (sales+scheduler; Manhour Labor sales-only); PTW files office-roles-only;
  navigation/template notes public-internal. Verified row-by-row against the live DB.

## Docs

- **`docs/server-pc-sync-checklist.md`** (new): phone-friendly, non-technical diagnosis
  checklist for the server PC — uptime, backup-folder dates, Task Scheduler columns, vault
  staleness, a live `git pull` test, and a decoder table mapping findings to causes.

## Incidents & lessons

- **Parallel-session collision**: a second Claude agent shared this working folder and
  switched branches mid-task twice. One chunker commit briefly landed on its
  `feat-live-updates` branch (left there — identical change is on dev/main; merges clean),
  and a session-end `git pull` while the folder sat on that branch merged dev into
  `feat-live-updates` (undo pending Nic's approval; harmless — the feature branch simply
  absorbed dev). **Rule**: check `git branch --show-current` before any git operation, and
  use a scratchpad `git worktree` whenever another agent may share the folder.
- **Supabase new-format secret keys** (`sb_secret_…`) reject requests with browser-like
  user agents — PowerShell's `Invoke-RestMethod` default UA starts with "Mozilla", so REST
  queries need an explicit custom UA.
- A checklist line claiming something is "set up and running" is not evidence — the
  same-day infra-backup session found the 02:00 backup had *never* been scheduled.

## Open items

- **Watchdog** — nothing alerts anyone if the vault sync (or backup) silently stops; that's
  how 57 days passed unnoticed. Offered: a Telegram alert when no sync/backup event has
  been logged for ~2 days, piggybacking on an existing Vercel cron (watchdog must not live
  on the machine being watched). Decision pending.
- Old DB password may still sit in Vercel env / Bryan's `.env.local` (from infra-backup).

## Key files

| File | Change |
|---|---|
| `scripts/lib/frontmatter.ts` + `.test.ts` | parser extracted + multi-line YAML fix (13 tests) |
| `scripts/lib/chunk.ts` + `.test.ts` | chunker extracted + CRLF fix (7 tests) |
| `scripts/obsidian-sync.ts` | imports both modules; trims orphaned chunk rows |
| `vault/Table of Content/PTW/*.md` | visibility frontmatter added (vault repo `38601bb`) |
| `docs/server-pc-sync-checklist.md` | new server diagnosis checklist |
| parser fix `67a047a` (dev; reached main via the 6 Aug dev→main merge), chunker fix `a3bd229` (dev) cherry-picked to main as `d781977` | how both fixes reached the server's branch |
