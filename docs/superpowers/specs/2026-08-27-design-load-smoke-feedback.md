# Smoke-test feedback — Design Load preview (2026-08-27)
Nic testing. NO changes until he says done.

1. Brief-required rule: keep for pre-book→edit flow, but SCHEDULER role bypasses it entirely — a scheduler saving a scheduled job (e.g. assigning installers) with a designer + empty brief must NOT be blocked. Bypass is scheduler-only (sales/coordinator still forced; the habit rule is aimed at them). Implementation sketch: skip briefRequiredError when effective role === 'scheduler' in JobDetailShell's onSubmit gate.

2. Design Load board layout redesign (screenshot: bubble clipped under sticky header):
   - Bars ANCHOR TO THE BOTTOM of the board area — skyline growing upward; applies on desktop AND mobile (bottom-up).
   - Bubble opens to the RIGHT SIDE of the hovered/tapped bar, overlaying neighbouring designers' bars temporarily (closes on mouse-leave/tap-away, so occlusion OK). Flip to LEFT for right-edge designers so it never overflows the viewport. Never clipped by the header again.
   - Columns SPAN THE FULL WIDTH of the view: designers share the width evenly (flex-grow), squeezing narrower as more designers are added — no horizontal scroll, fully responsive.
   - NOTE: Nic skipped checklist A4/A5 (AI score appears / no re-score on no-change save) — unverifiable while the hover bubble is clipped. RE-TEST both after the edit-2 layout fix lands.
   - UPDATE: A4/A5 PASSED — verified via the AI Scores feed (scoring fired on brief save; no-change save produced no new run). Only the bubble VISUAL remains blocked on edit 2.

3. Team tab: replace the small Designers chips row (label + "Nicholas x + Add") with a proper CARD like the installer selection — its own card section with selectable designer tiles in the InstallerGrid visual style (tile per designer, tap to select/deselect, selected state highlight). Same data/save wiring as now; purely a presentation upgrade.

4. Notification drawer (Updates section):
   - Clicking/tapping an update card MARKS IT READ (currently it re-pops as new on every refresh; navigate + mark-read in one tap).
   - "New design job assigned" cards show WHO assigned — the actual person (any role: scheduler/coordinator/sales/admin), identified from their account (display name, fall back to email). Requires the designers-assign route to stamp the assigner into the notification (e.g. body "Test DL A — assigned by Nicholas"). Consider same for due-shift cards (who moved the date) — confirm w/ Nic or just do assigned-by first.
   - Per-card 'X' button to clear that one notification.
   - "Clear All" control beside BOTH section headers (Overdue and Updates): Updates → deletes all notification rows; Overdue → cards are computed from live jobs (no rows to delete) so Clear All = the existing per-device mark-as-read mechanism greying them out. Note this nuance for Nic at delivery.
   - Due-shift cards: prefix the change with "Due date:" (e.g. "Due date: 14 Oct 2026 → 15 Oct 2026") so its meaning is obvious.
   - BOTH new card types (design job assigned + due-date shifted) also show the CLIENT and the INSTALL DATE for context.
   - NOTE: C4 (phone tap bubble + Open job button) skipped — bubble clipped by header, blocked on edit 2. RE-TEST after layout fix (joins A-section bubble re-tests).
   - TELEGRAM PARITY: the two Telegram templates must carry the same details as the upgraded bell cards — tplDesignAssigned adds "Assigned by: {person}" (already has project/client/install date per screenshot); tplDesignDueShift adds the "Due date:" label on the change line + Client + Install date. Bell and Telegram must read the same for both types.

5. Files tab, per-file row actions (move + delete icons in AttachmentBuckets): too small on PC, worse on mobile. Enlarge the icon buttons + their tap targets (comfortable touch size, ~40px hit area), both breakpoints. Pre-existing UI, not new to this branch, but fix in this round.

6. D8 change: ASSIGNED DESIGNERS may also Reopen a completed design (last-minute artwork changes), not just scheduler/admin. Route: design-reopen additionally allows an assigned designer of the job (job_designers membership check, like design-complete). UI: Reopen button shows for the assigned designer on design-completed jobs. Existing behavior kept: reopen clears the rating; re-completing re-rates (fresh slider).

7. Reminder cards must DISAPPEAR from the drawer once answered — both paths: Yes+rating-confirmed → gone; No → gone (whole card incl. Yes/No). Mechanic: drawer stops rendering read/answered design_reminder cards. The No path MUST keep the notification row (marked read) — its created_at drives the 3-day snooze in the cron; only the display hides. Yes path may delete or filter (job completed, cron won't re-ask). E3 confirmed PASSING otherwise (via manually planted reminder — cron route itself unreachable on preview due to Vercel deployment protection; verify schedule on production first morning).

8. ROLE CHANGE (Nic explicit): coordinator loses FORMAL installer assignment — suggest-only like sales, everywhere. Only scheduler (and admin) formally assigns. Touches: InstallerGrid mode for coordinator (suggest/yellow path + /suggest-installer route instead of /assign-installers), /api/jobs/[id]/assign-installers role gate (remove coordinator), notify-assigned flow, and the FCFS assignment panel for coordinators (OPEN QUESTION for Nic: FCFS panel for coordinator — suggest-only there too, or view-only?). Overdue/team-scope rules unchanged (formally assigned only). Reverses part of V2 Phase 2 (coordinator=scheduler assignment parity) — Nic's explicit call 2026-08-27.
   Addendum: formally-selected installer card fills FULLY GREEN (like suggestion fills fully yellow) — full-card fill, not just ring/badge.
   ANSWERED: FCFS assignment panel for coordinators = suggest-only as well (can add/suggest installers, cannot confirm suggestions or formally assign; Save & Notify assign path scheduler-only).

9. Production: ATTACHMENTS buckets section = VIEW-ONLY (no Image/Attachment/URL upload buttons, no add/delete bucket, no file delete/move — read + download only). Their PRODUCTION PHOTOS section stays editable as-is (that is what 0050's INSERT unlocked; it lives in ProductionReadySection, not the buckets). UI gate in the shell (readOnly for production on AttachmentBuckets); RLS stays as 0050 (blanket INSERT needed for production photos — server routes/UI carry the distinction).

10. Chinese-language fixes (job form):
   - Details card: several field labels stay English in zh mode (Project Title, Date, Day, Company, Location / Address, Job Description, Time start/end, Punctuality, Strict on-time, Flexible window) while others translate (客户名称 etc.). Audit CoreSection + related for missing zh keys / hardcoded EN; add zh (en fallback fine per rules, but these should have zh). Likely pre-existing, fix in this round.
   - Card/section titles (e.g. 工作详情, 附件) render too small in zh — the uppercase/tracking label style shrinks CJK. Enlarge card header titles so Chinese reads comfortably (bump size; drop letter-spacing for CJK if needed). App-wide card headers, not just these two.

FUTURE (own session, Nic labeled "future ui/ux change" — NOT in this fix round unless he says otherwise):
F1. Mobile-only nav restructure, all roles: bottom nav (too small) → LEFT DRAWER with hamburger icon; GreenQubes logo centered in the top bar; user profile moves from top-right into the drawer (bottom area, opens its usual menu when tapped); bell takes the top-right spot where the profile was. Desktop unchanged.

12. (2026-08-28, re-test) The assistant + bug floating buttons block the right-most designer's bar on the board (screenshot: Yu Fei hidden behind them). Make ALL root-level floating action buttons DRAGGABLE — user drags them anywhere on screen (touch + mouse), position remembered per device (localStorage), tap still opens as usual (movement threshold separates drag from tap), buttons clamped inside the viewport on load/resize. Defaults stay at today's spots.
