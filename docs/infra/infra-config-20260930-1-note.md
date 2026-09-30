---
session: infra-config (Supabase grants rule + Vercel Speed Insights cleanup)
date: 2026-09-30
branch: dev (docs only)
migrations: none
release: none — nothing reached main
---

# New tables need their own grants from 30 October

> Nic, forwarding Supabase's email: "need to insert this code to backend?"

## 1 — The Supabase notice

From **2026-10-30** Supabase stops automatically granting Data API access to
NEW tables in the `public` schema. Tables that exist before then keep their
grants. A new table without grants answers "permission denied" through
supabase-js — on production, preview branches and `supabase db reset` alike.

**Checked before answering:**
- None of the 63 migrations (0001–0063) grants table access by hand; every
  table relies on the old default grants. So nothing to change today.
- No table is read by a signed-out visitor: the `/ext/*` contractor pages go
  through `/api/ext/...` routes on the service key. So `anon` needs nothing.
- No migration uses `serial`/identity columns, so no sequence grants either.

**Answer given:** no code to insert now. Supabase's sample grants `select` to
`anon`; we deliberately leave that out.

## 2 — The rule (CLAUDE.md, Hard rules)

Every migration that creates a `public` table must, in the same file:

```sql
grant select, insert, update, delete on public.<table> to authenticated;
grant select, insert, update, delete on public.<table> to service_role;
```

- **Never `anon`** unless Nic approves it for that table.
- `serial`/identity tables also get `grant usage, select on sequence` to both.
- RLS stays enabled with policies as before — grants decide whether the API
  can reach the table, RLS decides which rows.
- Do not add grants to tables that existed before 2026-10-30.

Commit `2c45e44`, pushed to `dev`.

## 3 — Vercel Speed Insights, pressed by accident

Vercel's setup bot opened two branches on GitHub —
`vercel/install-and-configure-vercel-s-ijfb35` and `…-yla0ke` — each adding
`@vercel/speed-insights` to `package.json`, `package-lock.json` and
`src/app/layout.tsx`. Neither was ever in `dev` or `main`. Both deleted on
GitHub on Nic's word (the second needed its own explicit go — the safety
check refused it under the first approval).

Nic downgraded Speed Insights Plus in the Vercel dashboard. With no tracking
code in the app, basic Speed Insights records nothing; pressing Disable in the
Speed Insights tab is optional.

## ⚠ Next session

- First table-creating migration after 2026-10-30: follow the new grants rule.
- Still first under To build: the Files-tab 24-hour delete window.
