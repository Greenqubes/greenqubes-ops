---
session: feat-jobs (Client Contact No. fills itself from past jobs, month label centring)
date: 2026-10-30
branch: dev → main
migrations: none
release: fcb0e69 live 17:22 SGT (client number); changelog 5297716 + label fix 9ea4824 live together after
status: LIVE — the client number was checked by Nic on the dev preview before main; the label fix went straight through at his word
---

# Client Contact No. fills itself from past jobs

Continued the conversation from [ux-schedule-20261027-1-note.md](../ux/ux-schedule-20261027-1-note.md) ("hi lets continue client contact number auto fill"). Nic skipped the AI-importance question. Bryan was skipped.

## 1 — The feature (`fcb0e69`)

> "but instead can we autosuggest back last keyed in number to client?" · "yes it should switch and if david has no number, drop it into suggestion to ask user if want to reuse cynthia number instead"

**What happens on the job form (New Job and saved jobs):**

- Pick a company, then a Client Name. Client Contact No. fills from the **newest past job for the same person at the same company**. A grey line under it says where it came from: "From David's last job, 12 Oct 2026".
- **Nic's switching rule:**
  - Cynthia → David replaces the number.
  - If David has no past number, the box empties and a dashed button offers "Reuse Cynthia's number?". A ✕ dismisses it.
- **A number typed before any name was picked is never overwritten.** The past number is offered instead ("Use David's last number?"). This was my call, told to Nic.
- Changing the company counts as switching. Re-picking the same person changes nothing. Opening a job never changes its number.
- Hidden in installer view and when the core section is locked. en + zh text only (bn falls back).

**How it's built:**

- `src/lib/utils/client-phone.ts`: the pure rules.
  - `sameName`: case- and space-insensitive.
  - `lastNumberFor`: newest by **`created_at`, not `updated_at`**, because completing an old job bumps its edit time. It skips blank phones and the job being edited.
  - `phoneAfterPick`: returns the new box value plus the hint.
  - `likePattern`: escapes `%`/`_` for the ILIKE narrowing.
  - 27 checks; each was watched failing first. Two checks passed trivially at first and were rewritten to assert a specific older number.
- `GET /api/clients/last-phone?company&name&exclude`:
  - Runs on the **caller's session client**, so pending-privacy (0062) drafts stay hidden. Never move it to the service key.
  - ILIKE only narrows the read (50 rows, newest first). The exact match is done in JS.
- `CoreSection.tsx`:
  - `pickContact` fetches the number. A sequence counter drops a late answer, and an answer that arrives after the box was edited is ignored. A failed lookup never clears the box.
  - Typing in the box hides the hint.
  - `rememberPerson` keeps the previous person when the company or contact is cleared, so the "reuse" offer still works.
  - `JobDetailShell` passes `jobId`.

**Bug fixed on the way:** on a saved job, the Client Name list stayed locked on "Select a company first" until the company was picked again. The companies fetch now sets `selectedClientId` from the saved `client` text.

**Checked against live data (counts only, nothing copied out):**

- 86 company + person pairs; 83 get a number.
- 14 pairs have had more than one number over time.
- The narrowed DB read matched the full rule on 86 of 86 pairs.

66 suites green; type-check and build clean.

## 2 — Month label centring (`9ea4824`)

Nic's screenshot had a red line down the middle: "the buttons isnt rly aligned center of site.. even the october word as well". I measured the screenshot (sharp, in the scratchpad):

- **Red line** = the middle of the browser window, scrollbar included.
- **Schedule | Completed switch** = already in the middle of the page, lined up with "Design" in the bottom bar. The few-pixel gap is half the scrollbar. **Left alone.** Balancing it would mean a blank strip on the left of every page on desktop; I recommended against that and Nic didn't ask for it.
- **"OCTOBER 2026" label** = genuinely about 20px left. It centred over the strip, and the week/month toggle on the right pushes the strip left. **Fixed:**
  - The label row is now a full-width `1fr auto 1fr` grid, so the middle month sits in the middle of the page.
  - The right-hand month keeps its place over the › arrow with `mr-[37px]`: the toggle (33px) plus its gap (4px).

## 3 — Releases

- Nic: "ok looks good push to main". main fast-forwarded to `fcb0e69`, live **17:22 SGT**, from production's `x-vercel-id` epoch 1793352177376.
- What's new 2026-10-30 (`5297716`):
  - **added:** picking a client name fills in their last number; switching to a client with no number offers to keep the previous one.
  - **fixed:** the client name list opens on saved jobs.
  - This needed a second "push to main" (memory `feedback_prod_push_explicit`).
- Nic then said "push to main" after the label fix was committed. dev, then main, went to `9ea4824`, carrying the changelog and the label fix together. Verified with `/api/version` `d8d4c4207471`.
- The label fix is **not** in What's new: too small to notice, and adding it would have needed another production push. Nic then asked to "push to main but without the alignment updates". Nothing was pending (local, dev and main all at `9ea4824`), and the live What's new already leaves the alignment out. I offered to undo the alignment if that was what he meant, and he ended the session instead. **It stays live.**

## Next

- Watch for "wrong number came up" reports from sales; the rule is always the newest past job for that person at that company.
- Customer database: still parked on the old program's Export.
