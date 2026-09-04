# Voice PA — smoke test checklist

Feature: hands-free voice assistant (`feat-voice-pa`). Spec: `docs/superpowers/specs/2026-09-04-voice-pa-design.md`.
Test on the **branch preview** first. The important devices are the real sales phones.

## Device matrix

Run the core flow (section 1) on each; the rest once per platform is fine.

| | Android Chrome | iPhone Safari | PC Chrome |
|---|---|---|---|
| English | ☐ | ☐ | ☐ |
| 中文 (set your language to Chinese first) | ☐ | ☐ | ☐ |

Expectation notes: Android Chrome is the best case. **iPhone Safari may drop out of hands-free into "Tap, then speak" mode after a few blips — that is the designed fallback, not a bug** (report it only if voice stops working entirely).

## 1 — Core flow: create a job by talking

- [ ] The big glowing mic button shows on every page (Schedule, Pending, job form, Admin…), sits above the chat bubble, and can be dragged like the other buttons.
- [ ] Tap it → full-screen dark voice mode opens; the orb pulses; "Listening…" shows. First open asks for mic permission — allow it.
- [ ] Say: *"New job for [client] at [location] next Tuesday two pm."* Your words appear as you speak; when you pause, it sends.
- [ ] The PA **answers out loud** (and in text), asks for anything missing, and before creating reads back a summary and asks for a yes.
- [ ] Say *"yes, go ahead"* → "Creating the job…" then a green-ringed job chip appears; the PA confirms out loud.
- [ ] Tap the job chip → voice mode closes and the pending job opens, fields filled as spoken.
- [ ] The conversation appears afterwards in the Assistant page → History.

## 2 — Ask questions

- [ ] Ask *"what's on the schedule tomorrow?"* → spoken answer, short and natural (no bullet lists read aloud).
- [ ] Ask something from company knowledge → it searches and answers.

## 3 — Controls

- [ ] Mute button silences listening (orb grey); PA finishes its sentence if talking; unmute resumes.
- [ ] Keyboard button shows a type-instead box; typed messages get spoken replies.
- [ ] X closes voice mode from any state; nothing keeps talking afterwards.
- [ ] Reopen: it starts a fresh conversation.

## 4 — Permissions & roles

- [ ] Installer login: button shows; asking about their own job works; asking it to CREATE a job → polite spoken refusal (no job created).
- [ ] Deny mic permission (or use a browser with mic blocked): clear message + the type-instead box still works with spoken replies.

## 5 — Language

- [ ] With app language 中文: voice mode listens and replies in Mandarin; UI labels are Chinese.
- [ ] Bengali user (if tested): UI falls back to English, voice is English — expected v1 behaviour.

## Notes for Claude

_Anything odd — wrong words heard, robot voice too fast/slow, mic dying, double-speaking — write it here with device + language:_

-
