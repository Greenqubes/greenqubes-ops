# Guided App Tour — Smoke-Test Checklist

> Tick each box as you go. If something looks wrong, write a quick note next to it (what you saw,
> what you expected) and tell Claude. This is the last check before the tour ships to the whole
> team, so it's worth going through properly rather than skimming.

**What this is:** every team member's first sign-in now offers a two-minute guided walkthrough —
the screen dims, one real button lights up at a time, and a small card explains it. It finishes by
pointing at Connect Telegram, then closes with a plain "You're all set!" card. This checklist
confirms it actually works for every one of the 6 roles, on both a phone and a PC, before it goes
live for real.

---

## Before you start

- [ ] You're on the **dev preview** — Vercel dashboard → greenqubes-ops → Deployments → the latest
      `dev` one.
- [ ] Sign in as **yourself (admin)**. You'll use **Preview as** (the eye icon inside your account
      menu) to check all 6 roles from this one login — no need to log in and out 6 times.
- [ ] Have your **phone** and a **PC or laptop** both ready — the tour looks and behaves a bit
      differently on each (the job-creation form especially: tabs on phone, two columns on PC).

### A gotcha worth knowing before you start

The tour only shows its "welcome, want a tour?" offer automatically **once per person**, not once
per role. Because Preview as keeps you signed in as *yourself* the whole time, that "have they seen
it" memory is tied to **your own admin account**, not the role you're previewing. So the first time
you see the offer (on whichever role you check first) counts as "seen" for **all 6 roles** on that
browser — the offer will not pop up again automatically when you switch Preview as to a different
role, even on that role's home page.

**To test the auto-offer fairly for each role**, reset that memory between roles using either:
- A **private/incognito browser window** — sign in again fresh each time (simplest), or
- Your browser's developer tools → Application → Local Storage → delete the key that starts with
  `tour-seen:` (same effect, no re-login needed).

Everywhere below marked **"(reset first)"** means: do this reset before that check.

### About the 简体中文 and বাংলা copy — both unvetted

**Neither** the Chinese nor the Bengali tour text has been checked by a native speaker yet —
Nic's call, and it applies to both languages equally, including 简体中文 even though it's this
checklist's primary walkthrough language (item 2 below). Read both anyway and note down anything
that looks obviously wrong, badly worded, or doesn't fit its card, so it can be corrected live with
native speakers at the team demo. This is expected to need fixes in either language — it is not a
reason to fail the smoke test.

---

## The checklist — repeat for each role below, once on phone and once on PC

For every role × device pair, work through this same run in order:

1. **First offer** (reset first): visit any page that is *not* the role's home page first (e.g. a
   job link) — the welcome card must **not** appear there. Then go to the role's home page — the
   welcome card **does** appear.
2. Tap **Start tour** → the language chooser appears (English / 简体中文 / বাংলা) → pick
   **简体中文** → the **whole app** switches to Chinese right away, not just the tour, and the tour
   carries on in Chinese (简体中文 is unvetted too — see the note above; this whole walkthrough
   doubles as your Chinese read-through, not just item 3's close read).
3. Walk through every step (now in Chinese): each one shows either a **glowing ring around the
   right button**, or (for a few steps that just explain a concept, or where there's no real data
   yet on a fresh account) a **plain centred card with no ring** — both are correct by design,
   neither should look broken, blank, or pointing at nothing. Read at least **3 of the Chinese
   cards** closely and note anything that's missing, cut off, or clearly wrong (unvetted — see the
   note above; wording issues are not a fail, just write them down).
4. **Steps that jump to another page** (see the role's own list below) land on that page and the
   tour carries straight on without you doing anything.
5. **Second-to-last step**: the tour opens the account menu itself and puts the ring around
   **Connect Telegram** — the button in the card still says **Next** here, not Finish.
   **Last step**: one more card appears, centred with no ring, saying "You're all set!" — **this**
   is the one where the button finally says **Finish**.
6. Exit the tour (or let it finish) → the page underneath looks completely normal (nothing stuck
   dimmed or stuck open), the welcome offer does **not** pop up again on this device, and — open any
   other page — **the app is still in Chinese**: the language choice stuck after the tour, exactly
   as it should.
7. Open your **profile picture → App tour** → the tour restarts from step 1 immediately —
   **no language chooser this time** (it already knows your language; the chooser only shows up on
   the very first offer, never on a restart).
8. While that restarted tour is on screen, open the **account menu and switch language to বাংলা**
   *without* closing the tour → spot-check the **next 3 cards** (Bengali is unvetted — see the note
   above; jot down anything that looks wrong).
9. Switch to **dark mode** (account menu) → the dimmed background, the ring, and the card are all
   still easy to read — no invisible text, no white-on-white.
10. Switch language back to **English** (account menu) so the device is clean for the next role's
    check.
11. Confirm that throughout all of the above, the **bell**, any **floating buttons** (chat bubble,
    bug report), and the **bottom nav bar** never respond to a tap while the tour is on screen — it's
    look-only until you Exit or Finish.

---

## Sales

Home page: `/schedule`. Pages the tour jumps to (item 4): the **New Job form** (`/jobs/new`) and
the **FCFS board** (`/fcfs`). On phone, the Team step auto-switches the job form to its **Team**
tab for you — check that switch happens on its own.

### Phone
- [ ] 1. First offer (reset first)
- [ ] 2. Language chooser → 简体中文 (unvetted, see note above), whole app switches
- [ ] 3. Every step looks right (Chinese, unvetted) — read 3 cards closely, note wording issues
- [ ] 4. New Job form + FCFS board land correctly, job form auto-switches to the Team tab
- [ ] 5. Finale → account menu → Connect Telegram (still "Next") → closing "You're all set!" card ("Finish")
- [ ] 6. Exit restores the page, offer doesn't return, still Chinese elsewhere
- [ ] 7. App tour restarts from step 1, no chooser
- [ ] 8. Live-switch to বাংলা, 3 cards spot-checked (note anything odd)
- [ ] 9. Dark mode readable
- [ ] 10. Switch back to English
- [ ] 11. Bell / floating buttons / bottom nav inert during the tour

### PC
- [ ] 1. First offer (reset first)
- [ ] 2. Language chooser → 简体中文 (unvetted, see note above), whole app switches
- [ ] 3. Every step looks right (Chinese, unvetted) — read 3 cards closely, note wording issues
- [ ] 4. New Job form + FCFS board land correctly (Team is just a column here, no tab switch to check)
- [ ] 5. Finale → account menu → Connect Telegram (still "Next") → closing "You're all set!" card ("Finish")
- [ ] 6. Exit restores the page, offer doesn't return, still Chinese elsewhere
- [ ] 7. App tour restarts from step 1, no chooser
- [ ] 8. Live-switch to বাংলা, 3 cards spot-checked (note anything odd)
- [ ] 9. Dark mode readable
- [ ] 10. Switch back to English
- [ ] 11. Bell / floating buttons / bottom nav inert during the tour

---

## Scheduler

Home page: `/schedule`. Pages the tour jumps to (item 4): the **FCFS board** (`/fcfs`). The
Completed tab and Design Load steps only **highlight the menu link** — they don't actually open
those pages, that's expected.

### Phone
- [ ] 1. First offer (reset first)
- [ ] 2. Language chooser → 简体中文 (unvetted, see note above), whole app switches
- [ ] 3. Every step looks right (Chinese, unvetted) — read 3 cards closely, note wording issues
- [ ] 4. FCFS board lands correctly
- [ ] 5. Finale → account menu → Connect Telegram (still "Next") → closing "You're all set!" card ("Finish")
- [ ] 6. Exit restores the page, offer doesn't return, still Chinese elsewhere
- [ ] 7. App tour restarts from step 1, no chooser
- [ ] 8. Live-switch to বাংলা, 3 cards spot-checked (note anything odd)
- [ ] 9. Dark mode readable
- [ ] 10. Switch back to English
- [ ] 11. Bell / floating buttons / bottom nav inert during the tour

### PC
- [ ] 1. First offer (reset first)
- [ ] 2. Language chooser → 简体中文 (unvetted, see note above), whole app switches
- [ ] 3. Every step looks right (Chinese, unvetted) — read 3 cards closely, note wording issues
- [ ] 4. FCFS board lands correctly
- [ ] 5. Finale → account menu → Connect Telegram (still "Next") → closing "You're all set!" card ("Finish")
- [ ] 6. Exit restores the page, offer doesn't return, still Chinese elsewhere
- [ ] 7. App tour restarts from step 1, no chooser
- [ ] 8. Live-switch to বাংলা, 3 cards spot-checked (note anything odd)
- [ ] 9. Dark mode readable
- [ ] 10. Switch back to English
- [ ] 11. Bell / floating buttons / bottom nav inert during the tour

---

## Coordinator

Home page: `/schedule`. Pages the tour jumps to (item 4): the **New Job form** (`/jobs/new`) and
the **FCFS board** (`/fcfs`) — same as Sales. On phone, the job-team step auto-switches the job
form to its **Team** tab for you.

### Phone
- [ ] 1. First offer (reset first)
- [ ] 2. Language chooser → 简体中文 (unvetted, see note above), whole app switches
- [ ] 3. Every step looks right (Chinese, unvetted) — read 3 cards closely, note wording issues
- [ ] 4. New Job form + FCFS board land correctly, job form auto-switches to the Team tab
- [ ] 5. Finale → account menu → Connect Telegram (still "Next") → closing "You're all set!" card ("Finish")
- [ ] 6. Exit restores the page, offer doesn't return, still Chinese elsewhere
- [ ] 7. App tour restarts from step 1, no chooser
- [ ] 8. Live-switch to বাংলা, 3 cards spot-checked (note anything odd)
- [ ] 9. Dark mode readable
- [ ] 10. Switch back to English
- [ ] 11. Bell / floating buttons / bottom nav inert during the tour

### PC
- [ ] 1. First offer (reset first)
- [ ] 2. Language chooser → 简体中文 (unvetted, see note above), whole app switches
- [ ] 3. Every step looks right (Chinese, unvetted) — read 3 cards closely, note wording issues
- [ ] 4. New Job form + FCFS board land correctly (Team is just a column here, no tab switch to check)
- [ ] 5. Finale → account menu → Connect Telegram (still "Next") → closing "You're all set!" card ("Finish")
- [ ] 6. Exit restores the page, offer doesn't return, still Chinese elsewhere
- [ ] 7. App tour restarts from step 1, no chooser
- [ ] 8. Live-switch to বাংলা, 3 cards spot-checked (note anything odd)
- [ ] 9. Dark mode readable
- [ ] 10. Switch back to English
- [ ] 11. Bell / floating buttons / bottom nav inert during the tour

---

## Installer

Home page: `/installer`. This role's tour **never leaves that one page** — there's nothing to check
for item 4 beyond landing on `/installer` at the start. Three steps (the job page, job chat, and
photo upload) are **plain centred cards with no ring by design** — a fresh test account has no
assigned job to point at, so this is correct, not a bug.

### Phone
- [ ] 1. First offer (reset first)
- [ ] 2. Language chooser → 简体中文 (unvetted, see note above), whole app switches
- [ ] 3. Every step looks right (Chinese, unvetted, remember: 3 steps are centred cards on purpose) — read 3 cards closely, note wording issues
- [ ] 4. Stays on `/installer` throughout — nothing else to check here
- [ ] 5. Finale → account menu → Connect Telegram (still "Next") → closing "You're all set!" card ("Finish")
- [ ] 6. Exit restores the page, offer doesn't return, still Chinese elsewhere
- [ ] 7. App tour restarts from step 1, no chooser
- [ ] 8. Live-switch to বাংলা, 3 cards spot-checked (note anything odd)
- [ ] 9. Dark mode readable
- [ ] 10. Switch back to English
- [ ] 11. Bell / floating buttons / bottom nav inert during the tour

### PC
- [ ] 1. First offer (reset first)
- [ ] 2. Language chooser → 简体中文 (unvetted, see note above), whole app switches
- [ ] 3. Every step looks right (Chinese, unvetted, remember: 3 steps are centred cards on purpose) — read 3 cards closely, note wording issues
- [ ] 4. Stays on `/installer` throughout — nothing else to check here
- [ ] 5. Finale → account menu → Connect Telegram (still "Next") → closing "You're all set!" card ("Finish")
- [ ] 6. Exit restores the page, offer doesn't return, still Chinese elsewhere
- [ ] 7. App tour restarts from step 1, no chooser
- [ ] 8. Live-switch to বাংলা, 3 cards spot-checked (note anything odd)
- [ ] 9. Dark mode readable
- [ ] 10. Switch back to English
- [ ] 11. Bell / floating buttons / bottom nav inert during the tour

---

## Designer

Home page: `/schedule`. Page the tour jumps to (item 4): the **Design Load board**
(`/design-load`).

### Phone
- [ ] 1. First offer (reset first)
- [ ] 2. Language chooser → 简体中文 (unvetted, see note above), whole app switches
- [ ] 3. Every step looks right (Chinese, unvetted) — read 3 cards closely, note wording issues
- [ ] 4. Design Load board lands correctly
- [ ] 5. Finale → account menu → Connect Telegram (still "Next") → closing "You're all set!" card ("Finish")
- [ ] 6. Exit restores the page, offer doesn't return, still Chinese elsewhere
- [ ] 7. App tour restarts from step 1, no chooser
- [ ] 8. Live-switch to বাংলা, 3 cards spot-checked (note anything odd)
- [ ] 9. Dark mode readable
- [ ] 10. Switch back to English
- [ ] 11. Bell / floating buttons / bottom nav inert during the tour

### PC
- [ ] 1. First offer (reset first)
- [ ] 2. Language chooser → 简体中文 (unvetted, see note above), whole app switches
- [ ] 3. Every step looks right (Chinese, unvetted) — read 3 cards closely, note wording issues
- [ ] 4. Design Load board lands correctly
- [ ] 5. Finale → account menu → Connect Telegram (still "Next") → closing "You're all set!" card ("Finish")
- [ ] 6. Exit restores the page, offer doesn't return, still Chinese elsewhere
- [ ] 7. App tour restarts from step 1, no chooser
- [ ] 8. Live-switch to বাংলা, 3 cards spot-checked (note anything odd)
- [ ] 9. Dark mode readable
- [ ] 10. Switch back to English
- [ ] 11. Bell / floating buttons / bottom nav inert during the tour

---

## Production

Home page: `/schedule`. This role's tour **never leaves that page** — nothing to check for item 4
beyond landing on `/schedule` at the start. Two steps (the editable fields explainer and the files
explainer) are **plain centred cards with no ring by design** — a fresh account has no live job to
point at, so this is correct, not a bug.

### Phone
- [ ] 1. First offer (reset first)
- [ ] 2. Language chooser → 简体中文 (unvetted, see note above), whole app switches
- [ ] 3. Every step looks right (Chinese, unvetted, remember: 2 steps are centred cards on purpose) — read 3 cards closely, note wording issues
- [ ] 4. Stays on `/schedule` throughout — nothing else to check here
- [ ] 5. Finale → account menu → Connect Telegram (still "Next") → closing "You're all set!" card ("Finish")
- [ ] 6. Exit restores the page, offer doesn't return, still Chinese elsewhere
- [ ] 7. App tour restarts from step 1, no chooser
- [ ] 8. Live-switch to বাংলা, 3 cards spot-checked (note anything odd)
- [ ] 9. Dark mode readable
- [ ] 10. Switch back to English
- [ ] 11. Bell / floating buttons / bottom nav inert during the tour

### PC
- [ ] 1. First offer (reset first)
- [ ] 2. Language chooser → 简体中文 (unvetted, see note above), whole app switches
- [ ] 3. Every step looks right (Chinese, unvetted, remember: 2 steps are centred cards on purpose) — read 3 cards closely, note wording issues
- [ ] 4. Stays on `/schedule` throughout — nothing else to check here
- [ ] 5. Finale → account menu → Connect Telegram (still "Next") → closing "You're all set!" card ("Finish")
- [ ] 6. Exit restores the page, offer doesn't return, still Chinese elsewhere
- [ ] 7. App tour restarts from step 1, no chooser
- [ ] 8. Live-switch to বাংলা, 3 cards spot-checked (note anything odd)
- [ ] 9. Dark mode readable
- [ ] 10. Switch back to English
- [ ] 11. Bell / floating buttons / bottom nav inert during the tour

---

## Final pass — one real (non-admin) login

Preview as is convenient, but it's still *your* admin account underneath. As a last check, sign out
completely and sign in as **one genuine teammate account** (not admin, not Preview as) — pick
whichever role is easiest to arrange a real login for.

- [ ] Pick a real teammate's role and sign in as them directly (no Preview as).
- [ ] Run through the same numbered checklist above once, on either phone or PC.
- [ ] Confirm everything matches what Preview as showed for that role — this rules out anything
      that only breaks (or only works) because of the admin-account-plus-override setup.

---

## Standing maintenance — read this before any future UI redesign

- After any big UI change or redesign, **run the tour once for every role it touches.** If a step
  shows a plain centred card where a glowing ring used to be, that button's `data-tour` tag needs to
  be moved onto whatever replaced it.
- When **Workflow V3** merges, the tour scripts need a small update — new steps covering Projects.
