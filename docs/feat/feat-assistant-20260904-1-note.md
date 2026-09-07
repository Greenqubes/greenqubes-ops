---
session: feat-voice-pa (Voice PA — built, smoke-tested by Nic, PARKED; realtime rebuild next session)
date: 2026-09-04
branch: feat-voice-pa (worktree greenqubes-ops-voice-pa, off dev) — NEVER MERGED, preview only. Docs landed on dev (a9f5262).
---

# Voice PA — hands-free voice assistant (built, parked) + realtime vendor research

> Nic's brief: "some sales have resistant to using it because its too many insert
> steps they have to key. think old man that just wants it as easy as possible…
> a new BIG SHINY button EVERYWHERE… basically is like their personal PA that
> talks back. can anthropic api do it?"

## 1 — The answer that framed the whole session

**Claude's API is text-only.** Anthropic ships no voice API (Claude's own voice
mode is app-only, tied to Claude.ai accounts). So "Claude with a voice" is always
a sandwich: browser speech-to-text → Claude reasons in text → browser
text-to-speech. That is what was built, and Nic was told so explicitly when he
asked mid-session ("is this an TTS or realtime ai agent session?").

## 2 — What shipped to the branch (all working)

- **Big mic FAB on every page** (`FloatingVoiceButton`, `w-16`, lime glow ring,
  draggable via the existing `useDraggableFab` with `id: 'voice'`, `z-[60]`),
  folded into `FloatingChatWrapper` so ONE server query feeds both FABs.
- **`VoiceModeOverlay`** — full-screen, portalled to `document.body`, `z-[75]`
  (above panels/drawers `z-[70]`, below bug modal + tour `z-[80]`). Orb states,
  live transcript, streamed reply text, job chip, mute, type-instead.
- **`useVoiceSession`** — continuous `SpeechRecognition` in, `speechSynthesis`
  out (sentence-chunked so speech starts mid-stream), SSE consumption, save on
  close through the existing `/api/assistant/save`.
- **Four pure TDD modules** with standalone suites: `voiceLang` (lang→BCP-47 +
  voice picker), `speakable` (markdown→speakable), `sentenceChunker` (deltas→
  sentences, CJK-aware, decimals safe), `voiceMachine` (the conversation
  reducer; `responding` ends only when BOTH stream and speech queue drain).
- **Server change — exactly one, additive:** `voice?: boolean` on the chat route
  appends a reply-style line to the **volatile** parts. `SYSTEM_PREFIX`
  (lines 42–94) is byte-identical — the prompt cache is untouched. No migration.

Verification: 26 standalone suites green, `type-check` + production build clean.

## 3 — Nic's smoke test: three real bugs (all fixed)

1. **Overlay rendered fully transparent** — theme colours in `tailwind.config.ts`
   are bare `var()` strings with **no `<alpha-value>`**, so `bg-ink/95` compiles
   to nothing. Use `bg-black/55` (what `TourOverlay`/`NavDrawer` do) or an rgba
   literal. Also `bg-blue` doesn't exist — tokens are `brand-blue` etc.
   *Same class of bug the parallel feat-installer session hit hours earlier
   (30 bare `green`/`amber`/`blue` classes that had never compiled).*
2. **Android duplicated words** ("arrange arrange a job", "replace replace
   window replace window") — the transcript was rebuilt from the WHOLE
   `e.results` list on every event; Android Chrome re-emits earlier fragments.
   Fixed by accumulating from `e.resultIndex` with a repeated-final guard.
   This was also the real cause of "it doesnt understand information properly" —
   the model was receiving the duplicated mess as the user's words.
3. **Replies flipped to Chinese** on garbled English input (the prompt said
   "reply in the user's language"). Now pinned to the app-language setting.

## 4 — Nic's verdict + final polish

> "the voice agent u create is so choppy. it doesnt understand information
> properly" → "ok final polish then lets put this sandwich modelling aside for
> real agentic voice mode design the next session"

`/code-review` completed **3 of 7 angles** before a model usage limit killed the
rest — **coverage is partial; the bug-hunting angles never reported.** Fixed from
what did report:

- **`FloatingVoiceWrapper` duplicated `FloatingChatWrapper`** → auth + `users.lang`
  ran TWICE per page render app-wide, and one Suspense boundary coupled both
  FABs. Folded into the existing wrapper; duplicate file deleted.
- **bn users force-pinned to English replies** (three-value lang domain collapsed
  to two) → only en/zh are pinned now; bn defers to `SYSTEM_PREFIX` matching.
- **"Say dates and times naturally"** contradicted the CLAUDE.md hard rule
  (dates/day/month names always English) → clause removed.
- **Typed fallback told its input was garbled speech** → reworded to "spoken
  words reach you through speech recognition".
- **Typed-while-muted silently swallowed** → reducer accepts `utteranceReady`
  from `muted`, returns to `muted` after the reply (test added); send refuses
  only while a reply is in flight.
- Job chip used a hardcoded "Untitled job" → existing `untitledJob` i18n key.

~10 tidiness findings deliberately parked in spec **§7b** (third copies of the
SSE loop / save-POST / speech typings / `uid()` / job chip; hook-internal
redundancy). Not approved debt — re-evaluate at the rebuild.

## 5 — Realtime vendor research (Nic's ask)

Realtime voice **requires unlocking the stack** for a voice-infra vendor.

| Vendor | Claude | Mandarin | Cost | Verdict |
|---|---|---|---|---|
| **LiveKit Agents** | Official Anthropic plugin | ✅ via Cartesia/ElevenLabs | Build tier **free** (1,000 agent-min/mo, $0.01/min over) | **Recommended** |
| ElevenLabs Agents | Claude selectable / custom LLM | ✅ | $0.08/min + tokens | Runner-up |
| Vapi | ✅ | ✅ | ~$0.05/min + providers | Phone-call-first |
| Deepgram Voice Agent | Native `claude-sonnet-5` | ❌ English-only voices | low | **Ruled out (zh)** |

**Why LiveKit:** the agent code stays ours, so the per-user RLS model and the
existing tools (`create_pending_job`, schedule/job/workload/clash lookups) carry
over unchanged. Managed platforms run the loop on their servers, making our
per-user security fiddlier. All-in at this team's size: **~US$15–30/month**.
Plan sizing checked against livekit.com/pricing: **Build (free)** covers ~10
staff; Ship ($50) only if >5 simultaneous conversations or a staging deployment
is wanted.

## 6 — Design decisions already settled (reuse next session)

Talk → the PA creates the job (**never** the form — deliberately immune to a job-
form redesign) · hands-free with a mute button · English + Mandarin (bn falls
back) · full PA scope for every role, job creation still role-gated server-side ·
voice chats save as normal assistant conversations (history/memory/tagger).

## ⚠️ Next session

1. **Brainstorm → spec → plan the realtime voice agent.** Nic's stack unlock for
   a voice vendor is the gate; LiveKit is the standing recommendation.
2. **Decide the browser version's fate** — keep as a free fallback, or replace.
3. Housekeeping in the checklist: two spare worktree folders on this PC
   (`greenqubes-ops-workflow-v3`, `greenqubes-ops-voice-pa`).
4. The partial review means the voice code has **never had a full bug-hunting
   pass** — if any of it survives the rebuild, review it properly then.
