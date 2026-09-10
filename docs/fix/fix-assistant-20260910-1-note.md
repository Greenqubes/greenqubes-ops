---
session: fix-assistant (AI importance scoring — direction, not topic)
date: 2026-09-10
branch: dev → main (2afa820, 715d270)
migrations: none
---

# The digest was recycling the vault into itself

> Nic opened the session on the standing CLAUDE.md question about importance
> scoring and asked for a recommendation rather than a checklist prompt. The
> answer came from the live data, and the data said something the prompt alone
> would never have shown.

## 1 — What the data said

All 14 saved conversations, pulled from production:

| Score | What was actually there |
|---|---|
| 4 | 3 chats — **all** supplier pricing |
| 3 | 2 chats — "is CK free on 22 September", asked twice |
| 2 | a plywood weight sum, a Fossil job lookup |
| 1 | greetings, tests, orientation, a roster request, power-nap tips |

The 1s and 2s were fair. The 4s were not — and not because the topic was wrong.

Opening them:

- *"whats 3mm acrylic pricing"*
- *"whats my dama supplier cost price for 3mm clear acrylic"*
- *"our custom lightbox fabric system with fabric print included cost — $50 to
  $80psf"* → *"capture it for knowledge base"*

The first two are **questions**, answered out of
`Table of Content/Suppliers/DAMA Acrylic Sheet Supplier.md`, which is already
in `kb_chunks`. Promoting them writes a duplicate of the source note back into
the vault, to compete with the original in every future search. The third is a
person **depositing** a price that existed nowhere else.

All three scored the same 4, because the entire instruction was one line:

```
importance: number 1–5 (5 = critical business knowledge like supplier prices
or client escalations, 1 = trivial chitchat)
```

Two examples, nothing defined between them. The model anchored on the one
concrete noun it was given — "supplier prices" — and scored the topic.

## 2 — The fix

Score the **direction** of the information, not its subject. The question is
now *did something NEW arrive that exists nowhere else?*, with five defined
levels and one rule doing most of the work:

> **If the answer came from the knowledge base or from job/schedule data, the
> score is never above 2.** A question is a withdrawal; only a person stating
> something new is a deposit.

## 3 — Two things found while in there

**The visibility list was four roles behind.** It offered
`public-internal / sales / scheduler / installer` against eight real roles. The
RLS builds the token from the caller's own role
(`('role:' || get_my_role()) = ANY(visibility)`), so `role:hr`, `role:designer`,
`role:production` and `role:coordinator` had always worked — the prompt simply
never offered them. This is not cosmetic: a promoted chat's visibility becomes
the vault note's frontmatter, which the nightly sync writes into
`kb_chunks.visibility`, which RLS enforces. **That list is the entire vocabulary
for permissions on company knowledge.**

Sharper because HR shipped the day before: a chat mentioning why someone is on
medical leave defaulted to `public-internal`, and if promoted would have carried
the reason into the company-wide brain — the exact leak `user_leave_details`
was built to prevent. Named-person leave / medical / pay / discipline /
performance is now `role:hr` alone and never meaningful.

**The classifier was running at the default temperature.** The same
conversation scored 5 on one run and 4 on the next. For a classifier that is a
defect, and it also makes any before/after table meaningless. `temperature: 0`
added; two full re-scores are now byte-identical.

## 4 — Verification, and why no preview was needed

A throwaway script re-scored every real conversation through `tagConversation`
and printed before/after, run twice to prove stability. Deleted after use.

The prompt was edited **after** the first verification run (a tier-3 example
contradicted the hard rule), so the run was repeated against the final wording
rather than reported from the earlier one.

Nic merged straight to main without a preview. That was correct, and worth
recording why: **preview and production share the same database**, and the
tagger only fires server-side when a chat is saved — so a preview visit would
have been the identical code against identical data, testing strictly less than
the four runs already done.

Applied: 7 of 14 rows re-scored (`importance` + `visibility` only). Personal
`summary`/`embedding` deliberately untouched — whether *this person* should
recall something is a different question from whether the *company* should see
it. **Monday digest: 3 → 1**, and the 1 is the deposit.

## 5 — A false alarm, corrected in-session

Claude reported that the vault sync looked broken since August, because a
promoted plywood note sat in the vault with no `kb_chunks` row.

Wrong on both halves. The `events` table shows `obsidian_sync` running **every
night at 02:30 SGT without a miss**. And the note had no row because **Nic
deleted it on 2026-08-18** — the remote vault carried his removal commit, and
this clone was simply stale. Surfaced only when a push was rejected and the
rebase revealed his commit underneath.

**The lesson: a local clone is evidence of nothing until it is compared with
the remote.** The alarm was raised from a stale working copy without checking
either the remote or the `events` log — both a minute's work.

## 6 — Changelog written, then pulled

An entry was written because CLAUDE.md requires one whenever anything reaches
main. Nic pulled it: the change is invisible to everyone but digest
subscribers, and publishing it reopens the What's new popup for the whole team.
Removing it put 2026-09-09 back on top, which everyone has already seen.

The rule stands — this was judgement on one entry, not a change to the rule.

Writing it did expose a real bug in the rule itself. CLAUDE.md said a plain
clock reading is already correct SGT. **This shell reports MPST.** Neither that
nor `TZ=Asia/Singapore date` (which silently returns UTC) is Singapore time.
Release times now come from the production deployment's own clock: decode the
epoch-ms out of `x-vercel-id` and convert to UTC+8, after the deploy lands.
Same class of error as the earlier `07:33`-on-a-`15:24`-release incident.

## Facts worth keeping

- **A one-line prompt with one example does not classify — it anchors.** Every
  4 in the corpus matched the single noun in the instruction. Define the levels
  or the example becomes the rule.
- **The tagger's `visibility` list is the whole permission vocabulary for
  company knowledge** (chat → vault frontmatter → `kb_chunks.visibility` → RLS).
  It must be revisited whenever a role is added; four were missing for months.
- **Classification wants `temperature: 0`.** Otherwise scores drift a point run
  to run and no before/after comparison means anything.
- **Preview cannot test what preview and production share.** Both point at the
  same database; for server-side work with no UI, running the real code against
  real rows is the stronger test.
- **`asst_chats.meaningful` is not a column.** It is a gate — a non-meaningful
  chat saves with `summary` and `embedding` NULL. Selecting it errors `42703`.
- **The server syncs the vault with a plain `git pull` inside the vault folder,
  not `git submodule update`** — so the vault's own push is what reaches the
  02:30 sync; the parent's submodule pointer cannot resurrect deleted notes.
  Bump it anyway for consistency.
- **`docs/CONTEXT.md` is uppercase in git** and the vault's Table of Contents is
  Waypoint-generated — editing it by hand is usually the wrong move, but links
  to deleted notes do need removing.

## ⚠️ Next session

- **Ask the importance question with data, not as a formality.** Nic will keep
  revising it — his words, "still early phase". Pull `asst_chats` and
  `kb_chunks` before answering.
- **Watch what the Monday digest actually offers.** The only real test, and it
  needs weeks of real conversations. One judgement call to watch: a chat that
  both asks a question and adds something new is currently held down by the
  cap-at-2 rule.
- **One orphaned `kb_chunks` row** for the deleted greeting note clears at the
  02:30 sync — Nic's call over deleting it directly.
- **Still open from before:** the Support crew pill filter, the missing
  "scheduled job moved" notification, the realtime Voice PA vendor decision,
  and the auto-refresh-after-deploy idea parked 2026-09-08.
