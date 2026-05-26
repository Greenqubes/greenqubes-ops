# Chat Attachment Previews — Design Spec

**Date:** 2026-05-19
**Feature:** Attachment previews in job chat (image thumbnails, document cards, voice note play-button cards)
**File:** `src/features/job-detail/ChatSection.tsx`

---

## What we're building

Replace the current single tiny row used for all attachments with three distinct card types that match a WhatsApp-style chat layout. The design is the same regardless of which side (sender or receiver) — only the colour scheme flips (white background for others, terracotta for own messages).

---

## Three card types

### 1. Image attachment

- **Layout:** Card with full-width thumbnail on top (220px wide, 160px tall), footer strip below.
- **Footer:** Small image icon on the left, truncated filename in the middle, download arrow (16px) on the right.
- **Own message footer:** Footer strip background is terracotta (`--terracotta`); filename and icons are white/semi-transparent white. Thumbnail stays neutral (it's a photo, not tinted).
- **Others' message:** White background footer, muted icon colours.
- **Tap/click behaviour:** Triggers the existing download flow (fetches signed R2 URL, opens in new tab). No lightbox needed for Phase 0.
- **Corner radius:** `rounded-[14px_14px_14px_3px]` for others, `rounded-[14px_14px_3px_14px]` for own.

### 2. Document attachment

All non-image files (PDF, DOC, DOCX, XLS, XLSX, ZIP).

- **Layout:** Compact horizontal card — coloured icon box (44×44px, 10px radius) on the left, filename + file-type label in the middle, download arrow (16px) on the right.
- **Icon box colour by type:**
  - PDF → light red (`#FDECEA`, red icon)
  - XLS/XLSX → light green (`#E8F5E9`, green icon)
  - DOC/DOCX → light blue (`#EEF2FB`, blue icon)
  - ZIP + others → light amber (`#FFF8E1`, amber icon)
- **Sub-label:** File type in uppercase only (e.g. `PDF`, `Word Document`, `Spreadsheet`, `ZIP Archive`). File size is not stored in the DB or filename, so it is omitted.
- **Own message:** Full terracotta background; icon box becomes `rgba(255,255,255,0.2)`; text and download icon are white/semi-transparent white.
- **Tap/click behaviour:** Same download flow as image.
- **Corner radius:** Same pattern as image card.

### 3. Voice note

- **Layout:** Horizontal card — terracotta circular play button (38×38px) on the left, static waveform bars in the middle, duration + "Voice note" label on the right.
- **Waveform:** Static decorative bars (not live audio data). 12 bars with heights derived deterministically from a simple hash of the `voiceKey` string (so they are stable across re-renders). Heights range 30–95%. For Phase 0, all bars are fully coloured (no scrubbing / played-vs-unplayed split).
- **Play button:** Tapping loads the signed R2 URL and replaces the card with a native `<audio>` element (existing `VoicePlayer` lazy-load behaviour). Play icon becomes a pause icon while playing — handled natively by the audio element.
- **Duration:** Shown as `M:SS`. For Phase 0, duration is not stored in the DB — display `0:--` as placeholder until audio loads, then update from `audio.duration`.
- **Own message:** Card background is terracotta. Play button becomes `rgba(0,0,0,0.18)` (darkened circle). Waveform coloured bars become white; unplayed bars are `rgba(255,255,255,0.35)`.
- **Others' message:** White card background. Play button is terracotta. Waveform coloured bars are terracotta.
- **Corner radius:** Same pattern as above.

---

## File type detection

Detection is done by filename extension in the `FileAttachment` component (already done for `isImage`). Extend to cover:

```ts
const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)
const isPdf   = /\.pdf$/i.test(filename)
const isXls   = /\.xlsx?$/i.test(filename)
const isDoc   = /\.docx?$/i.test(filename)
const isZip   = /\.zip$/i.test(filename)
```

No changes to the DB schema or upload flow needed.

---

## What doesn't change

- Upload flow, R2 signed URL fetching, Supabase insert — untouched.
- Realtime subscription and `nameCacheRef` — untouched.
- The `toItems()` function and `ChatItem` type — untouched.
- All other components in `ChatSection.tsx` — untouched.
- i18n: no new strings needed (card labels like "Voice note" are decorative and already exist in `playVoiceNote`).

---

## Scope boundary

- No lightbox / full-screen image viewer (Phase 0).
- No audio scrubbing / progress bar (Phase 0).
- No file size display if metadata is unavailable — just omit it gracefully.
- No changes to how files are stored or named.
