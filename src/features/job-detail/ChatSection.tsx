'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import {
  Send, Paperclip, Download, FileText, Image as ImageIcon,
  Mic, StopCircle, Camera, Maximize2, Minimize2,
  FileSpreadsheet, FileArchive,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { chatAlbums } from '@/lib/utils/gallery'
import { useUnsavedWork } from '@/features/app-version/unsaved-work'
import type { JobFile, JobMessage } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

const CHAT_OPEN_DAYS = 7

// ── Avatar helpers (same logic as UserMenu) ──────────────────────────────────
const AVATAR_COLORS = ['bg-terracotta','bg-brand-green','bg-brand-blue','bg-brand-amber','bg-ink2']
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function avatarColor(name: string) {
  const hash = [...name].reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

// ── Upload filename formatter ─────────────────────────────────────────────────
function uploadName(userName: string, ext: string): string {
  const now  = new Date()
  const date = now.toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' })
  const time = now.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Singapore' })
  return `${userName} ${date} ${time}.${ext}`
}

function chatCutoff(completedAt: string): Date {
  const d = new Date(completedAt)
  d.setDate(d.getDate() + CHAT_OPEN_DAYS)
  return d
}

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
  zip:   { bg: 'bg-[#FFF8E1]', color: 'text-brand-amber' },
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

type ChatItem =
  | { kind: 'message'; id: string; authorId: string | null; author: string | null; content: string; ts: string }
  | { kind: 'voice';   id: string; authorId: string | null; author: string | null; voiceKey: string; ts: string }
  | { kind: 'file';    id: string; authorId: string | null; author: string | null; r2Key: string; filename: string; ts: string }

function toItems(messages: JobMessage[], files: JobFile[]): ChatItem[] {
  const items: ChatItem[] = [
    ...messages
      .filter(m => m.kind === 'text' && m.content)
      .map(m => ({
        kind:     'message' as const,
        id:       m.id,
        authorId: m.author_id,
        author:   m.users?.name ?? null,
        content:  m.content!,
        ts:       m.ts,
      })),
    ...messages
      .filter(m => m.kind === 'voice' && m.voice_url)
      .map(m => ({
        kind:     'voice' as const,
        id:       m.id,
        authorId: m.author_id,
        author:   m.users?.name ?? null,
        voiceKey: m.voice_url!,
        ts:       m.ts,
      })),
    ...files.map(f => ({
      kind:     'file' as const,
      id:       f.id,
      authorId: f.uploader_id,
      author:   f.users?.name ?? null,
      r2Key:    f.r2_key,
      filename: f.name ?? (f.r2_key.split('/').pop() ?? f.r2_key),
      ts:       f.ts,
    })),
  ]
  return items.sort((a, b) => a.ts.localeCompare(b.ts))
}

function FileAttachment({ r2Key, filename, lang, isMine = false, onOpen }: {
  r2Key: string; filename: string; lang: LangCode; isMine?: boolean
  /** Opens the photo full screen in the job Gallery's viewer (Nic, 2026-11-11). */
  onOpen?: () => void
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
      .then(r => r.json())
      .then((data: { url: string }) => setSignedUrl(data.url))
      .catch(() => { /* thumbnail stays as placeholder icon */ })
  }, [r2Key, kind])

  const download = async () => {
    setDlLoading(true)
    try {
      // Always fetch a fresh URL here (not the cached thumbnail one) so the
      // signed link carries the real filename for saving.
      const res = await fetch('/api/r2/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: r2Key, filename }),
      })
      const { url } = await res.json() as { url: string }
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
        <button type="button" onClick={onOpen} disabled={!onOpen}
          className="h-[160px] w-full bg-line flex items-center justify-center disabled:cursor-default">
          {signedUrl
            ? <img src={signedUrl} alt={filename} className="w-full h-full object-cover" />
            : <ImageIcon size={24} className="text-muted" />}
        </button>
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

// Chat albums (Nic, 2026-11-11): 4+ photos sent together stack into one
// 2×2 block, the 4th tile showing "+N" when there are more — like WhatsApp.
function ChatAlbum({ photos, isMine, onOpen }: {
  photos: Array<{ id: string; r2Key: string }>; isMine: boolean; onOpen: (id: string) => void
}) {
  const shown = photos.slice(0, 4), more = photos.length - 4
  return (
    <div className={cn('grid grid-cols-2 gap-0.5 w-[220px] overflow-hidden border border-line bg-paper',
      isMine ? 'rounded-[14px_14px_3px_14px]' : 'rounded-[14px_14px_14px_3px]')}>
      {shown.map((p, i) => (
        <AlbumTile key={p.id} r2Key={p.r2Key} more={i === 3 && more > 0 ? more : 0} onOpen={() => onOpen(p.id)} />
      ))}
    </div>
  )
}

function AlbumTile({ r2Key, more, onOpen }: { r2Key: string; more: number; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/r2/download-url', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: r2Key }),
    })
      .then(r => r.json())
      .then((d: { url?: string }) => setUrl(d.url ?? null))
      .catch(() => { /* tile stays as placeholder */ })
  }, [r2Key])
  return (
    <button type="button" onClick={onOpen} className="relative aspect-square bg-line flex items-center justify-center">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={18} className="text-muted" />}
      {more > 0 && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-lg font-semibold text-white">+{more}</span>
      )}
    </button>
  )
}

/** A chat photo, file or voice note deleted for everyone leaves this line
 *  where it was (migration 0070 chat_deletions). */
type ChatDeletion = { id: string; item_kind: 'photo' | 'video' | 'file' | 'voice'; item_ts: string; deleted_by_name: string }
const DELETED_KEY = {
  photo: 'chatDeletedPhoto', video: 'chatDeletedVideo', file: 'chatDeletedFile', voice: 'chatDeletedVoice',
} as const

function VoicePlayer({ voiceKey, isMine = false }: {
  voiceKey: string; isMine?: boolean
}) {
  const [src,         setSrc]         = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [playing,     setPlaying]     = useState(false)
  const [duration,    setDuration]    = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
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
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ key: voiceKey }),
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
        onTimeUpdate={e => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0) }}
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
        {bars.map((h, i) => {
          const played = duration ? (i / bars.length) < (currentTime / duration) : false
          return (
            <div
              key={i}
              className={cn(
                'flex-1 rounded-sm transition-colors',
                isMine
                  ? played ? 'bg-white'       : 'bg-white/35'
                  : played ? 'bg-terracotta'  : 'bg-line',
              )}
              style={{ height: `${h}%` }}
            />
          )
        })}
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

const NUM_BARS = 28

type RecordState = 'idle' | 'recording' | 'uploading'

interface Props {
  jobId:              string
  userId:             string
  userName:           string
  lang:               LangCode
  completedAt:        string | null
  initialMessages:    JobMessage[]
  chatFiles:          JobFile[]
  preScheduleLocked?: boolean
}

export function ChatSection({ jobId, userId, userName, lang, completedAt, initialMessages, chatFiles, preScheduleLocked = false }: Props) {
  const { success: showSuccess, error: showError } = useToast()
  const supabase = useMemo(() => createClient(), [])
  const bottomRef        = useRef<HTMLDivElement>(null)
  const fileRef          = useRef<HTMLInputElement>(null)
  const cameraRef        = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const streamRef        = useRef<MediaStream | null>(null)
  const analyserRef      = useRef<AnalyserNode | null>(null)
  const audioCtxRef      = useRef<AudioContext | null>(null)
  const animFrameRef     = useRef<number | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const barsRef          = useRef<HTMLDivElement[]>([])
  // userId → display name, seeded from server-loaded messages
  const nameCacheRef     = useRef<Record<string, string>>(
    Object.fromEntries(
      initialMessages
        .filter(m => m.author_id && m.users?.name)
        .map(m => [m.author_id!, m.users!.name])
    )
  )

  const [messages,       setMessages]       = useState<JobMessage[]>(initialMessages)
  const [files,          setFiles]          = useState<JobFile[]>(chatFiles)
  // The job Gallery (Nic, 2026-11-11): what this person hid for themselves
  // (Delete for me) and the grey lines left by Delete for everyone.
  const [hiddenFiles,    setHiddenFiles]    = useState<Set<string>>(new Set())
  const [hiddenMsgs,     setHiddenMsgs]     = useState<Set<string>>(new Set())
  const [deletions,      setDeletions]      = useState<ChatDeletion[]>([])
  const albumOfRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    let active = true
    const loadExtras = async () => {
      // Before migration 0070 is applied these tables don't exist: both read as empty.
      const [h, d] = await Promise.all([
        supabase.from('job_item_hides' as never).select('file_id, message_id').eq('job_id', jobId) as unknown as
          Promise<{ data: Array<{ file_id: string | null; message_id: string | null }> | null; error: unknown }>,
        supabase.from('chat_deletions' as never).select('id, item_kind, item_ts, deleted_by_name').eq('job_id', jobId) as unknown as
          Promise<{ data: ChatDeletion[] | null; error: unknown }>,
      ])
      if (!active) return
      // A failed read keeps what's shown (hidden items must not reappear).
      if (!h.error) {
        setHiddenFiles(new Set((h.data ?? []).map(r => r.file_id).filter((x): x is string => !!x)))
        setHiddenMsgs(new Set((h.data ?? []).map(r => r.message_id).filter((x): x is string => !!x)))
      }
      if (!d.error) setDeletions(d.data ?? [])
    }
    void loadExtras()
    let gone: ReturnType<typeof supabase.channel> | null = null
    let extras: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
      // Unchanged list when the id isn't there: a new array would scroll the
      // chat (and the page) to the bottom on every delete (final review I6).
      const dropFile = (p: { old: Record<string, unknown> }) => {
        if (p.old?.job_id && p.old.job_id !== jobId) return
        const id = p.old?.id as string | undefined
        if (id) setFiles(fs => fs.some(x => x.id === id) ? fs.filter(x => x.id !== id) : fs)
      }
      const dropMsg = (p: { old: Record<string, unknown> }) => {
        if (p.old?.job_id && p.old.job_id !== jobId) return
        const id = p.old?.id as string | undefined
        if (id) setMessages(ms => ms.some(x => x.id === id) ? ms.filter(x => x.id !== id) : ms)
      }
      // Two channels: the new tables (migration 0070) may not exist yet, and
      // that must not stop deleted photos leaving the chat (final review I8).
      gone = supabase.channel(`job-chat-gone-${jobId}`)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'files', filter: `job_id=eq.${jobId}` }, dropFile)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `job_id=eq.${jobId}` }, dropMsg)
        .subscribe()
      extras = supabase.channel(`job-chat-gallery-${jobId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_deletions', filter: `job_id=eq.${jobId}` }, () => void loadExtras())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_item_hides', filter: `user_id=eq.${userId}` }, () => void loadExtras())
        .subscribe()
    })
    // A hide or delete in the Gallery on this device shows here at once.
    const onChanged = () => void loadExtras()
    window.addEventListener('gallery:changed', onChanged)
    return () => {
      active = false
      window.removeEventListener('gallery:changed', onChanged)
      if (gone) void supabase.removeChannel(gone)
      if (extras) void supabase.removeChannel(extras)
    }
  }, [supabase, jobId, userId])

  // The Gallery's "Go to message": scroll to it and flash it.
  useEffect(() => {
    function onGoto(e: Event) {
      const key = (e as CustomEvent<{ key: string }>).detail?.key
      if (!key) return
      setTimeout(() => {
        const el = document.getElementById('chat-item-' + (albumOfRef.current.get(key) ?? key))
        if (!el) return
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el.classList.add('bg-brand-amber-soft')
        setTimeout(() => el.classList.remove('bg-brand-amber-soft'), 1600)
      }, 150)
    }
    window.addEventListener('chat:goto', onGoto)
    return () => window.removeEventListener('chat:goto', onGoto)
  }, [])
  const [text,           setText]           = useState('')
  const [sending,        setSending]        = useState(false)
  const [uploading,      setUploading]      = useState(false)
  const [recordState,    setRecordState]    = useState<RecordState>('idle')
  const [recordSecs,     setRecordSecs]     = useState(0)
  const [chatLocked,     setChatLocked]     = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'live' | 'error'>('connecting')
  const [fullscreen,     setFullscreen]     = useState(false)

  // Sending, uploading or mid-recording all count as work in progress, so the
  // post-deploy auto-refresh waits instead of cutting them off.
  useUnsavedWork('chat', sending || uploading || recordState !== 'idle')

  const cutoff = completedAt ? chatCutoff(completedAt) : null

  // Evaluated client-side only — avoids server/client timezone mismatch (hydration error)
  useEffect(() => {
    if (cutoff) setChatLocked(new Date() > cutoff)
  }, [cutoff])

  useEffect(() => {
    fetch(`/api/jobs/${jobId}/chat-read`, { method: 'POST' }).catch(() => {})
  }, [jobId])

  const inputDisabled = preScheduleLocked || chatLocked || sending || uploading || recordState !== 'idle'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, files])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (timerRef.current)    clearInterval(timerRef.current)
      audioCtxRef.current?.close()
    }
  }, [])

  const startWaveform = useCallback((stream: MediaStream) => {
    const ctx     = new AudioContext()
    const source  = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)
    audioCtxRef.current = ctx
    analyserRef.current = analyser

    const data = new Uint8Array(analyser.frequencyBinCount)
    const draw = () => {
      analyser.getByteFrequencyData(data)
      barsRef.current.forEach((bar, i) => {
        if (!bar) return
        const idx = Math.floor(i * data.length / NUM_BARS)
        const pct = Math.max(8, (data[idx] / 255) * 100)
        bar.style.height = `${pct}%`
      })
      animFrameRef.current = requestAnimationFrame(draw)
    }
    draw()
  }, [])

  const stopWaveform = useCallback(() => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
    if (timerRef.current)     { clearInterval(timerRef.current); timerRef.current = null }
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    barsRef.current.forEach(bar => { if (bar) bar.style.height = '8%' })
    setRecordSecs(0)
  }, [])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let active = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(`job-chat-${jobId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `job_id=eq.${jobId}` },
          payload => {
            const row = payload.new as JobMessage
            if (row.author_id === userId) {
              // Own message — inject name from props
              const msg = { ...row, users: { name: userName } }
              setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
            } else {
              const cached = row.author_id ? nameCacheRef.current[row.author_id] : undefined
              if (cached) {
                const msg = { ...row, users: { name: cached } }
                setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
              } else {
                // Add immediately (avatar shows '?'), then patch name once fetched
                setMessages(prev => prev.find(m => m.id === row.id) ? prev : [...prev, row])
                if (row.author_id) {
                  const authorId = row.author_id
                  supabase.from('users').select('name').eq('id', authorId).single()
                    .then(({ data }) => {
                      const name = (data as { name: string } | null)?.name
                      if (name) {
                        nameCacheRef.current[authorId] = name
                        setMessages(prev => prev.map(m =>
                          m.id === row.id ? { ...m, users: { name } } : m
                        ))
                      }
                    })
                }
              }
            }
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'files', filter: `job_id=eq.${jobId}` },
          payload => {
            const row = payload.new as JobFile
            if (row.kind !== 'attachment') return
            // Bucket uploads share kind 'attachment' but belong to the
            // Attachments section, not the chat.
            if (row.bucket_id) return
            // Realtime payloads carry only the row's own columns, never the
            // joined users.name — so resolve the uploader name the same way
            // the messages handler does, otherwise the bubble shows "Unknown".
            if (row.uploader_id === userId) {
              const f = { ...row, users: { name: userName } }
              setFiles(prev => prev.find(x => x.id === f.id) ? prev : [...prev, f])
            } else {
              const cached = row.uploader_id ? nameCacheRef.current[row.uploader_id] : undefined
              if (cached) {
                const f = { ...row, users: { name: cached } }
                setFiles(prev => prev.find(x => x.id === f.id) ? prev : [...prev, f])
              } else {
                // Add immediately (avatar shows '?'), then patch name once fetched
                setFiles(prev => prev.find(x => x.id === row.id) ? prev : [...prev, row])
                if (row.uploader_id) {
                  const uploaderId = row.uploader_id
                  supabase.from('users').select('name').eq('id', uploaderId).single()
                    .then(({ data }) => {
                      const name = (data as { name: string } | null)?.name
                      if (name) {
                        nameCacheRef.current[uploaderId] = name
                        setFiles(prev => prev.map(f =>
                          f.id === row.id ? { ...f, users: { name } } : f
                        ))
                      }
                    })
                }
              }
            }
          },
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') setRealtimeStatus('live')
          else if (err || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error')
        })
    })

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [jobId, supabase])

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || inputDisabled) return

    setSending(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: trimmed }),
      })
      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        showError(error === 'Chat closed' ? t(lang, 'chatLockedMessage') : t(lang, 'saveError'))
        return
      }
      setText('')
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setSending(false)
    }
  }

  const handleRecord = async () => {
    if (recordState === 'recording') {
      mediaRecorderRef.current?.stop()
      stopWaveform()
      return
    }
    if (recordState !== 'idle') return

    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      const recorder = new MediaRecorder(streamRef.current)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        setRecordState('uploading')
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

          const urlRes = await fetch('/api/r2/upload-url', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ jobId, kind: 'voice', filename: uploadName(userName, 'webm'), contentType: 'audio/webm' }),
          })
          const { url, key } = await urlRes.json() as { url: string; key: string }

          await fetch(url, {
            method:  'PUT',
            headers: { 'Content-Type': 'audio/webm' },
            body:    blob,
          })

          const res = await fetch(`/api/jobs/${jobId}/messages`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ kind: 'voice', voice_url: key }),
          })
          if (!res.ok) showError(t(lang, 'saveError'))
        } catch {
          showError(t(lang, 'saveError'))
        } finally {
          setRecordState('idle')
        }
      }

      recorder.start()
      setRecordState('recording')
      startWaveform(streamRef.current)
      setRecordSecs(0)
      timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000)
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploading(true)
    try {
      const urlRes = await fetch('/api/r2/upload-url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jobId, kind: 'attachment', filename: file.name, contentType: file.type || 'application/octet-stream' }),
      })
      const { url, key } = await urlRes.json() as { url: string; key: string }

      await fetch(url, {
        method:  'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body:    file,
      })

      await supabase.from('files').insert({
        job_id:      jobId,
        kind:        'attachment',
        r2_key:      key,
        name:        file.name,
        uploader_id: userId,
        visibility:  ['public-internal'],
      } as never).throwOnError()

      await fetch(`/api/jobs/${jobId}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ kind: 'attachment', filename: file.name }),
      })

      showSuccess(t(lang, 'savedSuccessfully'))
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setUploading(false)
    }
  }

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const ext      = file.name.split('.').pop() ?? 'jpg'
    const filename = uploadName(userName, ext)

    setUploading(true)
    try {
      const urlRes = await fetch('/api/r2/upload-url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jobId, kind: 'attachment', filename, contentType: file.type || 'image/jpeg' }),
      })
      const { url, key } = await urlRes.json() as { url: string; key: string }

      await fetch(url, {
        method:  'PUT',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body:    file,
      })

      await supabase.from('files').insert({
        job_id:      jobId,
        kind:        'attachment',
        r2_key:      key,
        name:        filename,
        uploader_id: userId,
        visibility:  ['public-internal'],
      } as never).throwOnError()

      await fetch(`/api/jobs/${jobId}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ kind: 'attachment', filename }),
      })

      showSuccess(t(lang, 'savedSuccessfully'))
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setUploading(false)
    }
  }

  const items = toItems(messages.filter(m => !hiddenMsgs.has(m.id)), files.filter(f => !hiddenFiles.has(f.id)))
  type Entry = { kind: 'item'; ts: string; item: ChatItem } | { kind: 'deleted'; ts: string; d: ChatDeletion }
  const entries: Entry[] = [
    ...items.map(i => ({ kind: 'item' as const, ts: i.ts, item: i })),
    ...deletions.map(d => ({ kind: 'deleted' as const, ts: d.item_ts, d })),
  ].sort((a, b) => a.ts.localeCompare(b.ts))
  const keyOf = (i: ChatItem) => (i.kind === 'file' ? 'f:' : 'm:') + i.id
  const isImage = (i: ChatItem) => i.kind === 'file' && fileKind(i.filename) === 'image'
  const albums = chatAlbums(entries.map(e => e.kind === 'item'
    ? { key: keyOf(e.item), isImage: isImage(e.item), byId: e.item.authorId, ts: e.ts }
    : { key: 'd:' + e.d.id, isImage: false, byId: null, ts: e.ts }))
  const albumAt = new Map(albums.map(a => [a[0], a]))
  const albumOf = new Map<string, string>()
  albums.forEach(a => a.forEach(k => albumOf.set(k, a[0])))
  albumOfRef.current = albumOf
  const openInGallery = (key: string) => window.dispatchEvent(new CustomEvent('gallery:open', { detail: { key } }))

  return (
    <Card className={cn(
      'flex flex-col overflow-hidden',
      fullscreen && 'fixed inset-0 z-[60] rounded-none',
    )}>
      {/* header */}
      <div className="px-5 py-3 border-b border-line flex items-center justify-between shrink-0">
        <h3 className="text-sm font-medium text-ink">
          {chatLocked ? t(lang, 'jobChatTitleLocked') : t(lang, 'jobChatTitle')}
        </h3>
        <div className="flex items-center gap-3">
          {cutoff && !chatLocked && (
            <span className="text-xs text-muted hidden sm:inline">
              {t(lang, 'chatOpenUntil')} {cutoff.toLocaleDateString()}
            </span>
          )}
          {!chatLocked && (
            <span className="flex items-center gap-1.5">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                realtimeStatus === 'live'  ? 'bg-brand-lime' :
                realtimeStatus === 'error' ? 'bg-bad animate-pulse' :
                'bg-muted animate-pulse'
              )} />
              <span className={cn(
                'text-xs font-medium',
                realtimeStatus === 'live'  ? 'text-brand-green' :
                realtimeStatus === 'error' ? 'text-bad' :
                'text-muted'
              )}>
                {realtimeStatus === 'live'  ? t(lang, 'chatLive') :
                 realtimeStatus === 'error' ? t(lang, 'chatSyncing') : '…'}
              </span>
            </span>
          )}
          {/* Enlarge / shrink — mobile only */}
          <button
            onClick={() => setFullscreen(f => !f)}
            className="md:hidden p-1.5 text-muted hover:text-ink transition-colors rounded"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Expand chat'}
          >
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* messages */}
      <div className={cn(
        'flex-1 overflow-y-auto px-5 py-4 space-y-3',
        fullscreen ? 'min-h-0' : 'min-h-[280px] max-h-[520px]',
      )}>
        {entries.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">{t(lang, 'noMessages')}</p>
        ) : (
          entries.map(entry => {
            if (entry.kind === 'deleted') {
              return (
                <p key={'d:' + entry.d.id} className="text-center text-[11px] italic text-muted">
                  {t(lang, DELETED_KEY[entry.d.item_kind]).replace('{name}', entry.d.deleted_by_name)}
                </p>
              )
            }
            const item = entry.item
            const key = keyOf(item)
            const album = albumAt.get(key)
            if (albumOf.has(key) && !album) return null   // drawn inside its album
            const isMine = item.authorId === userId
            return (
              <div key={item.id} id={'chat-item-' + key}
                className={cn('flex items-end gap-2 rounded-xl transition-colors', isMine && 'flex-row-reverse')}>
                {/* Avatar — others only */}
                {!isMine && (
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0',
                    item.author ? avatarColor(item.author) : 'bg-ink2',
                  )}>
                    {item.author ? initials(item.author) : '?'}
                  </div>
                )}

                {/* Content */}
                <div className={cn('space-y-0.5 min-w-0 max-w-[75%]', isMine && 'items-end flex flex-col')}>
                  {!isMine && (
                    <p className="text-xs text-muted">{item.author ?? 'Unknown'}</p>
                  )}
                  {item.kind === 'message' ? (
                    <p className={cn(
                      'text-sm rounded-2xl px-3 py-2 inline-block',
                      isMine
                        ? 'bg-terracotta text-white rounded-br-sm'
                        : 'bg-bg text-ink rounded-bl-sm',
                    )}>
                      {item.content}
                    </p>
                  ) : item.kind === 'voice' ? (
                    <VoicePlayer voiceKey={item.voiceKey} isMine={isMine} />
                  ) : album ? (
                    <ChatAlbum
                      isMine={isMine}
                      photos={album.map(k => files.find(f => 'f:' + f.id === k)).filter((f): f is JobFile => !!f)
                        .map(f => ({ id: f.id, r2Key: f.r2_key }))}
                      onOpen={id => openInGallery('f:' + id)}
                    />
                  ) : (
                    <FileAttachment r2Key={item.r2Key} filename={item.filename} lang={lang} isMine={isMine}
                      onOpen={isImage(item) ? () => openInGallery(key) : undefined} />
                  )}
                  <p className="text-[10px] text-muted" suppressHydrationWarning>
                    {new Date(item.ts).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' })}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* pre-schedule locked banner */}
      {preScheduleLocked && (
        <div className="px-5 py-3 bg-bg border-t border-line text-sm text-muted text-center">
          {t(lang, 'chatPreScheduleMessage')}
        </div>
      )}

      {/* post-completion locked banner */}
      {!preScheduleLocked && chatLocked && (
        <div className="px-5 py-3 bg-bg border-t border-line text-sm text-muted text-center">
          {t(lang, 'chatLockedMessage')}
        </div>
      )}

      {/* input bar */}
      {!preScheduleLocked && !chatLocked && (
        <div className="px-4 py-3 border-t border-line flex items-center gap-4">
          <input
            type="file"
            ref={fileRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
          />
          <input
            type="file"
            ref={cameraRef}
            onChange={handleCameraCapture}
            className="hidden"
            accept="image/*"
            capture="environment"
          />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={inputDisabled}
            title={t(lang, 'attachFile')}
            className="text-muted hover:text-ink transition-colors disabled:opacity-40 shrink-0"
          >
            {uploading
              ? <span className="text-xs text-muted">{t(lang, 'uploading')}</span>
              : <Paperclip size={16} />}
          </button>

          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={inputDisabled}
            title="Take photo"
            className="text-muted hover:text-ink transition-colors disabled:opacity-40 shrink-0"
          >
            <Camera size={16} />
          </button>

          <button
            type="button"
            onClick={handleRecord}
            disabled={chatLocked || sending || uploading}
            title={t(lang, 'recordVoiceNote')}
            className={`shrink-0 transition-colors disabled:opacity-40 ${
              recordState === 'recording'
                ? 'text-terracotta'
                : recordState === 'uploading'
                  ? 'text-muted'
                  : 'text-muted hover:text-ink'
            }`}
          >
            {recordState === 'recording'
              ? <StopCircle size={16} />
              : <Mic size={16} />}
          </button>

          {recordState === 'recording' ? (
            <div className="flex-1 flex items-center gap-2 rounded-lg border border-terracotta bg-terracotta/5 px-3 py-1.5 h-[38px]">
              <span className="text-xs font-medium text-terracotta tabular-nums w-8 shrink-0">
                {String(Math.floor(recordSecs / 60)).padStart(2, '0')}:{String(recordSecs % 60).padStart(2, '0')}
              </span>
              <div className="flex-1 flex items-center gap-[2px] h-full">
                {Array.from({ length: NUM_BARS }).map((_, i) => (
                  <div
                    key={i}
                    ref={el => { if (el) barsRef.current[i] = el }}
                    className="flex-1 bg-terracotta rounded-full"
                    style={{ height: '8%' }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              disabled={inputDisabled}
              placeholder={t(lang, 'messagePlaceholder')}
              className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50"
            />
          )}

          {recordState !== 'recording' && (
            <Btn
              size="sm"
              onClick={handleSend}
              disabled={inputDisabled || !text.trim()}
              aria-label={t(lang, 'sendMessage')}
            >
              <Send size={13} />
            </Btn>
          )}
        </div>
      )}
    </Card>
  )
}
