# Voice PA — hands-free voice assistant (design)

**Date:** 2026-09-04 · **Branch:** `feat-voice-pa` (worktree `../greenqubes-ops-voice-pa`, off `dev`)
**Status:** Approved in chat by Nic ("build ahead") — V3 rounds 2–3 paused pending live-team feedback; V3 job form may be redone, so this feature deliberately never touches the job form.

## 1. Goal

Some salespeople resist the New Job form — too many fields to key. Give them a **personal PA they talk to**: a big glowing mic button on every page opens a full-screen voice mode (ChatGPT-voice style). They speak, the PA answers **out loud**, asks for what's missing, confirms, and inserts the job as a **pending job** through the assistant's existing `create_pending_job` action. Zero typing, one tap total.

## 2. Decisions (Nic, 2026-09-04 brainstorm)

1. **Talk → PA creates it** — build on the existing assistant + `create_pending_job`; no form involvement.
2. **Hands-free conversation** — tap once, then pure back-and-forth: PA speaks, mic auto-reopens. Big X to leave. (A big mute button is included for noisy sites — accepted in the design chat.)
3. **Languages: English + Mandarin** — chosen by the user's existing `users.lang`; `bn` users get English voice (browser Bengali STT is unreliable — revisit later).
4. **Full PA scope** — everything the typed assistant does (schedule lookups, job details, workload, clashes, KB) plus job insertion. Button shows for **every role**; job creation stays role-gated server-side exactly as today (polite in-chat refusal for installer/designer/production).

Out of scope for v1 (explicitly): natural-voice paid TTS vendor (stack locked — separate Nic decision later), barge-in interruption while the PA is speaking, Bengali voice, wake word, project(workspace)-scoped voice chats, the mobile app.

## 3. Architecture — a voice shell around the existing brain

Claude's API is text-in/text-out; the voice experience is a three-part sandwich, two parts browser-native (free), one part already built:

| Part | Technology | Status |
|---|---|---|
| Ears | Web Speech API `SpeechRecognition` (same API as the composer dictation mic, `AssistantShell.tsx:517-539`), continuous + interim | New usage, proven pattern |
| Brain | `POST /api/assistant/chat` — SSE agentic tool loop, `create_pending_job`, RLS-scoped tools, memory, tagger | **Exists, untouched except one additive flag** |
| Mouth | `speechSynthesis` — speak sentence-by-sentence as SSE `text` deltas stream in | New (no TTS exists in the repo) |

### 3.1 Server change (the only one): a `voice` flag on the chat route

`src/app/api/assistant/chat/route.ts` request body gains `voice?: boolean`. When true, the route appends a **voice-style instruction** to the *volatile* system block (block 2 in normal chats, `route.ts:199` — deliberately uncached, so `SYSTEM_PREFIX` at lines 42–94 stays byte-identical and the cache prefix is untouched):

> Voice mode: the user is speaking to you and hears your reply read aloud. Reply in the user's language, short and conversational — one to three sentences unless more is truly needed. Never use markdown, bullet lists, tables, or URLs. Say dates and times naturally. When creating a job, read back a one-sentence summary and ask for a spoken yes before calling the tool.

Voice sessions never send `projectId`, so the project-chat cached-prefix path (`route.ts:192-197`) is unaffected. Everything else — SSE event shapes (`status` / `text` / `job_created` / `sources` / `error` / `done`), the 8-round tool loop, D-Promote's canned two-frame short-circuit, usage logging — is reused verbatim. The so-far-unused `done` frame (`route.ts:421`) becomes the voice client's end-of-turn signal.

### 3.2 Client conversation loop (pure state machine + one hook)

States: `idle → listening → sending → responding(speaking) → listening → …`, plus `muted`, `error`, `unsupported`, and a `tapToTalk` degraded mode.

- **Listening:** `SpeechRecognition` with `continuous: true`, `interimResults: true`, `lang` from `voiceLangTag(userLang)` (`zh → 'zh-CN'`, else `'en-SG'` — same mapping as dictation). Interim transcript shows live on screen. **End-of-utterance:** when a final result lands and ~1.2 s passes with no further speech, the transcript is sent. Empty/whitespace results are discarded.
- **Auto-restart:** Chrome silently ends recognition after ~60 s idle and on network blips; `onend` while still in `listening` restarts it. After 3 failed restarts in a row, degrade to **tap-to-talk** (a visible mic button per utterance) instead of dying silently — this is also the expected iPhone Safari experience, where continuous recognition is unreliable.
- **Responding:** the mic is fully **stopped** (not just ignored) the moment a turn is sent, so the PA never hears its own voice. SSE `text` deltas feed a **sentence chunker** (split on `. ! ? 。 ！ ？` + newlines); each complete sentence is stripped to speakable text (markdown/links/emoji removed) and queued as a `SpeechSynthesisUtterance` in the user's voice language. When the SSE `done` frame has arrived **and** the TTS queue drains, the mic reopens → `listening`.
- **Mute:** big toggle; stops recognition, stays in voice mode. **Close (X):** cancels speech + recognition + any in-flight request (AbortController), saves the chat, closes the overlay.
- **iOS unlock:** the opening tap speaks a zero-length utterance to unlock `speechSynthesis` (Safari requires a user gesture before audio).
- **Voices:** picked from `speechSynthesis.getVoices()` by language prefix (handling the async `voiceschanged` load); prefer local-service voices. If no matching voice exists, text still streams on screen with a "voice unavailable on this device" note.

### 3.3 UI

- **`FloatingVoiceButton`** — the big shiny button: `w-16 h-16` glowing orb (moss green with a `--lime` pulse ring — the reserved non-text highlight token), mounted in `src/app/layout.tsx` beside the existing FABs, draggable via `useDraggableFab({ id: 'voice' })`, `z-[60]`, default position above the assistant bubble (`right-4 bottom-[128px] lg:bottom-[184px]`), hidden on `/login` only. Server wrapper (like `FloatingChatWrapper.tsx`) fetches `users.lang`; unauthenticated → null.
- **`VoiceModeOverlay`** — full-screen, **portalled to `document.body`** (the `NavDrawer.tsx:89-104` stacking-context lesson), `z-[75]` (above panels/drawers at `z-[70]`, below the bug modal and tour at `z-[80]`), satisfying the bottom-nav hard rule. Contents: big pulsing orb whose animation reflects the state (listening / thinking / speaking), the live "heard" transcript line, the PA's streamed reply text (voice-mode users can always *read* along), status line reusing `statusLabels.ts` keys, a **job chip** on `job_created` (tap → navigate to the job, overlay closes), big mute toggle, big X.
- All new copy via `t()` keys in `en.ts` + `zh.ts` (`bn` falls back — freeze holds). Date labels English-only rule doesn't apply to *spoken* output (that's the model's text), only to UI labels.

### 3.4 Persistence

A voice session is a normal assistant conversation: each open starts a fresh chat, saved through the same save/tagger flow the floating panel uses, so history, per-user memory, digest importance and the Memory manager all work unchanged. No migration; no new tables; **no DB change at all**.

## 4. New files

```
src/features/voice/voiceLang.ts        + .test.ts   — lang → STT/TTS tags, voice pick helper (pure)
src/features/voice/speakable.ts        + .test.ts   — markdown/links/emoji → speakable text (pure)
src/features/voice/sentenceChunker.ts  + .test.ts   — stream deltas → complete sentences (pure)
src/features/voice/voiceMachine.ts     + .test.ts   — conversation state machine reducer (pure)
src/features/voice/useVoiceSession.ts               — wires recognition + synthesis + SSE + machine
src/features/voice/VoiceModeOverlay.tsx             — full-screen voice UI
src/components/FloatingVoiceButton.tsx              — the big shiny FAB
src/components/FloatingVoiceWrapper.tsx             — server wrapper (auth + lang)
```

Touched: `src/app/layout.tsx` (mount), `src/app/api/assistant/chat/route.ts` (voice flag + volatile-block line), `src/lib/i18n/en.ts` + `zh.ts` (new keys). Pure modules follow the repo's standalone-suite convention (`npx tsx <path>`, hand-rolled `check()`, exit 1 on failure).

## 5. Error handling

- No `SpeechRecognition` support → overlay opens in **type-to-talk** fallback (text input + spoken replies) with a plain-language note.
- Mic permission denied → clear message with how to re-enable; overlay stays usable as type-to-talk.
- Recognition `onerror` → surfaced (unlike dictation's silent swallow), one retry, then tap-to-talk.
- SSE `error` frame / network failure → shown on screen ("Something went wrong — say that again?"), mic reopens so the user can simply repeat themselves. Errors are never spoken (keeps translation out of the hook).
- `speechSynthesis` missing/voiceless → text-only replies + note (never blocks the conversation).

## 6. Testing & verification

1. Standalone suites for the four pure modules (chunker: multi-delta sentences, CJK punctuation, trailing fragment on `done`; speakable: links, lists, bold, emoji; machine: full happy path + mute/close/error/degrade transitions; lang: en/zh/bn mapping).
2. `npm run type-check` + production build green; full standalone sweep still green.
3. Preview smoke (Nic, on real devices): Android Chrome + iPhone Safari × en + zh — create a job end-to-end by voice, ask a schedule question, mute on noise, installer-role refusal, job chip navigation. Smoke checklist doc to be produced with the build.

## 7. Honest limits (accepted for v1)

Browser TTS voices are clear but robotic (natural voices = paid vendor = separate Nic decision). iPhone Safari likely lands in tap-to-talk mode. Open mic picks up site noise → mute button. Speech recognition on Chrome routes audio via Google's speech service (standard for all Chrome dictation — worth knowing, not storing anything ourselves).

## 7b. Review findings PARKED at hand-off (2026-09-04)

Nic's verdict after testing the browser build: too choppy, mishearings, robotic —
**the sandwich model is parked; next session designs a realtime agentic voice
mode (LiveKit + Claude, see the vendor comparison in that session's brainstorm).**
A `/code-review` run over the branch completed 3 of 7 angles (the rest died on a
model usage limit — **coverage is partial; bug-hunting angles never reported**).

Fixed before parking: duplicate wrapper query (app-wide, every page render),
Bengali users force-pinned to English replies, a voice instruction that
contradicted the English-dates company rule, typed input being told it was
garbled speech, hardcoded "Untitled job" ignoring the existing i18n key,
typed-while-muted being silently swallowed, and send-while-replying.

Deliberately NOT fixed (internal tidiness in code the realtime build replaces —
re-evaluate then, do not treat as approved debt):
- **Third copy of the SSE client loop** (`useVoiceSession.streamTurn` vs
  `AssistantShell.tsx:432-480` vs `FloatingChatPanel.tsx:224-269`). Past the
  extraction threshold; the copies already disagree (voice drops the `error`
  frame's `message`). If the realtime build keeps an SSE path, extract
  `streamAssistantChat()` first.
- **Third copy of the save-conversation POST** (`shutdown()` vs the two chat
  surfaces) — the spec's "saves exactly like floating-panel chats" promise is
  held together by hand.
- **Duplicated Web Speech typings + `getSpeechRecognition()`** (hook vs
  `AssistantShell.tsx:52-76`), and `speechLangTag`'s mapping duplicated inline
  at `AssistantShell.tsx:525`. Both vanish if the realtime vendor owns speech.
- **Third private `uid()`**; **third job-chip copy** (extract `JobCardChip` with
  a light/dark variant if the chip survives).
- **Hook-internal redundancy:** `supported.tts` is dead state (`ttsOkRef` is the
  real flag), `streamEndedRef` double-books the reducer's `streamDone`,
  `turnsRef` is hand-mirrored at every write, the overlay's `startedRef` and
  `mounted` guards are both redundant, `pickVoice` forces a map/re-find
  round-trip, and `sendTyped` is a pass-through of `sendUtterance`.
- **bn has no voice translations** (freeze holds — bn falls back to English
  throughout). If the realtime build ships to bn users, that needs Nic's call.

## 8. Rollout

`feat-voice-pa` → push → Vercel preview → Nic device smoke → merge to `dev` → dev preview → `main`. Independent of the V3 worktree/branch and its one-clean-cut rule.
