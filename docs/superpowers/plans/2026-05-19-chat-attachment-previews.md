# Chat Attachment Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single tiny attachment row in job chat with three distinct card types — image thumbnail, document card, and voice note play-button card.

**Architecture:** All changes are isolated to two sub-components inside `src/features/job-detail/ChatSection.tsx` (`FileAttachment` and `VoicePlayer`). Helper functions are added at the top of the file. The `isMine` prop is threaded into both sub-components so they can flip to terracotta styling when the message belongs to the current user. No DB changes, no new files.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide React, existing `/api/r2/download-url` route.

---

## File map

| File | Change |
|---|---|
| `src/features/job-detail/ChatSection.tsx` | Add helpers + update imports; rewrite `FileAttachment`; rewrite `VoicePlayer`; pass `isMine` at call sites |

---

## Task 1 — Add helpers and update imports

**Files:**
- Modify: `src/features/job-detail/ChatSection.tsx:10-13` (imports)
- Modify: `src/features/job-detail/ChatSection.tsx` (add helpers after existing avatar helpers, before `FileAttachment`)

### Steps

- [ ] **Step 1.1 — Update the lucide-react import line**

Replace the existing import on line 10–13:

```tsx
import {
  Send, Paperclip, Download, FileText, Image as ImageIcon,
  Mic, StopCircle, Camera, Maximize2, Minimize2,
  FileSpreadsheet, FileArchive,
} from 'lucide-react'
```

Note: play/pause use inline SVG in VoicePlayer (see Task 3) — no Lucide import needed for those.

- [ ] **Step 1.2 — Add helpers after the `chatCutoff` function (after line 44)**

Insert this block between `chatCutoff` and the `ChatItem` type definition:

```tsx
// ── File-kind helpers ────────────────────────────────────────────────────────
type FileKind = 'image' | 'pdf' | 'xls' | 'doc' | 'zip' | 'other'
type DocKind  = Exclude<FileKind, 'image'>

function fileKind(filename: string): FileKind {
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) return 'image'
  if (/\.pdf$/i.test(filename))                      return 'pdf'
  if (/\.xlsx?$/i.test(filename))                    return 'xls'
  if (/\.docx?$/i.test(filename))                    return 'doc'
  if (/\.zip$/i.test(filename))                      return 'zip'
  return 'other'
}

const FILE_TYPE_LABEL: Record<DocKind, string> = {
  pdf:   'PDF',
  xls:   'Spreadsheet',
  doc:   'Word Document',
  zip:   'ZIP Archive',
  other: 'File',
}

const DOC_ICON_CONFIG: Record<DocKind, { bg: string; color: string }> = {
  pdf:   { bg: 'bg-[#FDECEA]', color: 'text-[#C0392B]' },
  xls:   { bg: 'bg-[#E8F5E9]', color: 'text-[#2E7D32]' },
  doc:   { bg: 'bg-[#EEF2FB]', color: 'text-[#3D6FB5]' },
  zip:   { bg: 'bg-[#FFF8E1]', color: 'text-amber' },
  other: { bg: 'bg-[#EEF2FB]', color: 'text-ink2' },
}

function docIconComponent(kind: DocKind) {
  if (kind === 'xls') return FileSpreadsheet
  if (kind === 'zip') return FileArchive
  return FileText
}

// ── Waveform helper ──────────────────────────────────────────────────────────
// Deterministic bar heights derived from the voice key so they are stable
// across re-renders.
function waveformBars(key: string, count = 12): number[] {
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0
  }
  return Array.from({ length: count }, () => {
    h = (h * 1664525 + 1013904223) >>> 0
    return 30 + (h % 66) // 30–95
  })
}
```

- [ ] **Step 1.3 — Typecheck**

```bash
cd c:/Greenqubes_GitHub/greenqubes-ops && npx tsc --noEmit
```

Expected: no errors related to the new helpers. Ignore any pre-existing unrelated errors.

- [ ] **Step 1.4 — Commit**

```bash
git add src/features/job-detail/ChatSection.tsx
git commit -m "feat(chat): add file-kind helpers and waveform helper"
```

---

## Task 2 — Rewrite FileAttachment component

**Files:**
- Modify: `src/features/job-detail/ChatSection.tsx` — replace `FileAttachment` function (lines 86–124)

### Steps

- [ ] **Step 2.1 — Replace the entire `FileAttachment` function**

Delete lines 86–124 (the entire current `FileAttachment` function) and replace with:

```tsx
function FileAttachment({ r2Key, filename, lang, isMine }: {
  r2Key: string; filename: string; lang: LangCode; isMine: boolean
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [dlLoading, setDlLoading] = useState(false)
  const kind = fileKind(filename)
  const radius = isMine ? 'rounded-[14px_14px_3px_14px]' : 'rounded-[14px_14px_14px_3px]'

  // Eagerly fetch signed URL for images so the thumbnail shows on render
  useEffect(() => {
    if (kind !== 'image') return
    fetch('/api/r2/download-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: r2Key }),
    })
      .then(r => r.json() as Promise<{ url: string }>)
      .then(({ url }) => setSignedUrl(url))
      .catch(() => { /* thumbnail stays as placeholder icon */ })
  }, [r2Key, kind])

  const download = async () => {
    setDlLoading(true)
    try {
      const url = signedUrl ?? await fetch('/api/r2/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: r2Key }),
      }).then(r => r.json() as Promise<{ url: string }>).then(d => d.url)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.target = '_blank'; a.rel = 'noopener'
      a.click()
    } finally {
      setDlLoading(false)
    }
  }

  // ── Image card ─────────────────────────────────────────────────────────────
  if (kind === 'image') {
    return (
      <div className={cn('overflow-hidden border border-line bg-paper w-[220px]', radius)}>
        <div className="h-[160px] bg-line flex items-center justify-center">
          {signedUrl
            ? <img src={signedUrl} alt={filename} className="w-full h-full object-cover" />
            : <ImageIcon size={24} className="text-muted" />}
        </div>
        <div className={cn('flex items-center gap-2 px-3 py-2', isMine ? 'bg-terracotta' : 'bg-paper')}>
          <ImageIcon size={13} className={cn('shrink-0', isMine ? 'text-white/70' : 'text-muted')} />
          <span className={cn('flex-1 text-xs truncate min-w-0', isMine ? 'text-white' : 'text-ink2')}>
            {filename}
          </span>
          <button
            type="button"
            onClick={download}
            disabled={dlLoading}
            className="shrink-0 disabled:opacity-50"
          >
            <Download size={16} className={isMine ? 'text-white/75' : 'text-muted'} />
          </button>
        </div>
      </div>
    )
  }

  // ── Document card ──────────────────────────────────────────────────────────
  const docKind = kind as DocKind
  const { bg: iconBg, color: iconColor } = DOC_ICON_CONFIG[docKind]
  const DocIcon = docIconComponent(docKind)

  return (
    <button
      type="button"
      onClick={download}
      disabled={dlLoading}
      className={cn(
        'flex items-center gap-3 px-3.5 py-3 min-w-[220px] border transition-colors disabled:opacity-50',
        radius,
        isMine
          ? 'bg-terracotta border-terracotta hover:bg-terracotta/90'
          : 'bg-paper border-line hover:bg-bg',
      )}
    >
      <div className={cn('w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0', isMine ? 'bg-white/20' : iconBg)}>
        <DocIcon size={22} className={isMine ? 'text-white' : iconColor} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', isMine ? 'text-white' : 'text-ink')}>
          {filename}
        </p>
        <p className={cn('text-xs mt-0.5', isMine ? 'text-white/70' : 'text-muted')}>
          {FILE_TYPE_LABEL[docKind]}
        </p>
      </div>
      <Download size={16} className={cn('shrink-0', isMine ? 'text-white/75' : 'text-muted')} />
    </button>
  )
}
```

- [ ] **Step 2.2 — Typecheck**

```bash
cd c:/Greenqubes_GitHub/greenqubes-ops && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 2.3 — Commit**

```bash
git add src/features/job-detail/ChatSection.tsx
git commit -m "feat(chat): rewrite FileAttachment with image thumbnail and document card"
```

---

## Task 3 — Rewrite VoicePlayer and wire isMine at call sites

**Files:**
- Modify: `src/features/job-detail/ChatSection.tsx` — replace `VoicePlayer` function (lines 126–163) and update both call sites in the render loop

### Steps

- [ ] **Step 3.1 — Replace the entire `VoicePlayer` function**

Delete lines 126–163 (the entire current `VoicePlayer` function) and replace with:

```tsx
function VoicePlayer({ voiceKey, isMine }: {
  voiceKey: string; isMine: boolean
}) {
  const [src,      setSrc]      = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [playing,  setPlaying]  = useState(false)
  const [duration, setDuration] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bars     = useMemo(() => waveformBars(voiceKey), [voiceKey])
  const radius   = isMine ? 'rounded-[14px_14px_3px_14px]' : 'rounded-[14px_14px_14px_3px]'

  // Auto-play once the signed URL is fetched
  useEffect(() => {
    if (src && audioRef.current) void audioRef.current.play()
  }, [src])

  const handlePlay = async () => {
    if (loading) return
    if (!src) {
      setLoading(true)
      try {
        const res = await fetch('/api/r2/download-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: voiceKey }),
        })
        const { url } = await res.json() as { url: string }
        setSrc(url)
      } catch {
        // silent — button stays idle
      } finally {
        setLoading(false)
      }
      return
    }
    if (!audioRef.current) return
    if (playing) audioRef.current.pause()
    else void audioRef.current.play()
  }

  const fmtDuration = duration != null
    ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
    : '0:--'

  return (
    <div className={cn(
      'flex items-center gap-3 px-3.5 py-3 min-w-[220px] border',
      radius,
      isMine ? 'bg-terracotta border-terracotta' : 'bg-paper border-line',
    )}>
      <audio
        ref={audioRef}
        src={src ?? undefined}
        onLoadedMetadata={e => setDuration((e.target as HTMLAudioElement).duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
      <button
        type="button"
        onClick={handlePlay}
        disabled={loading}
        className={cn(
          'w-[38px] h-[38px] rounded-full flex items-center justify-center shrink-0 transition-opacity disabled:opacity-50',
          isMine ? 'bg-black/20' : 'bg-terracotta',
        )}
      >
        {loading ? (
          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white" className="ml-0.5">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      <div className="flex-1 flex items-center gap-[2px] h-7">
        {bars.map((h, i) => (
          <div
            key={i}
            className={cn('flex-1 rounded-sm', isMine ? 'bg-white/60' : 'bg-terracotta/60')}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>

      <div className="flex flex-col items-end shrink-0">
        <span className={cn('text-xs font-medium tabular-nums', isMine ? 'text-white' : 'text-ink2')}>
          {fmtDuration}
        </span>
        <span className={cn('text-[10px]', isMine ? 'text-white/70' : 'text-muted')}>
          Voice note
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.2 — Pass `isMine` at both call sites in the render loop**

Find this block in the render (inside the `items.map` loop):

```tsx
} : item.kind === 'voice' ? (
  <VoicePlayer voiceKey={item.voiceKey} lang={lang} />
) : (
  <FileAttachment r2Key={item.r2Key} filename={item.filename} lang={lang} />
)}
```

Replace with:

```tsx
} : item.kind === 'voice' ? (
  <VoicePlayer voiceKey={item.voiceKey} isMine={isMine} />
) : (
  <FileAttachment r2Key={item.r2Key} filename={item.filename} lang={lang} isMine={isMine} />
)}
```

- [ ] **Step 3.3 — Typecheck**

```bash
cd c:/Greenqubes_GitHub/greenqubes-ops && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3.4 — Commit**

```bash
git add src/features/job-detail/ChatSection.tsx
git commit -m "feat(chat): rewrite VoicePlayer as play-button card, wire isMine to attachment components"
```

---

## Task 4 — Visual verification and push

**Files:** None (verification only)

### Steps

- [ ] **Step 4.1 — Start dev server**

```bash
cd c:/Greenqubes_GitHub/greenqubes-ops && npm run dev
```

- [ ] **Step 4.2 — Open a job with chat attachments**

Navigate to any job that has existing file attachments and/or voice notes. Verify:

1. **Image files** (jpg, png, webp): Show a thumbnail preview. Footer has filename (truncated) and download arrow on the right.
2. **Documents** (pdf, docx, xlsx): Show the compact card with coloured icon box, filename, file-type label, download arrow on the right.
3. **Voice notes**: Show the play button (terracotta circle), waveform bars, and `0:--` duration. Tap play — bars load, audio plays, duration updates, icon flips to pause.
4. **Own messages (right-aligned)**: Image footer is terracotta. Document card is fully terracotta. Voice card is terracotta with lighter bars.
5. **Others' messages (left-aligned)**: White background on all cards.

- [ ] **Step 4.3 — Push to dev branch**

```bash
git push origin dev
```

Wait for Vercel preview to build, then verify on mobile (the primary use case for installers).
