'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import {
  Send, Paperclip, Download, FileText, Image as ImageIcon,
  Mic, StopCircle, Camera, Maximize2, Minimize2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
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

type ChatItem =
  | { kind: 'message'; id: string; author: string | null; content: string; ts: string }
  | { kind: 'voice';   id: string; author: string | null; voiceKey: string; ts: string }
  | { kind: 'file';    id: string; author: string | null; r2Key: string; filename: string; ts: string }

function toItems(messages: JobMessage[], files: JobFile[]): ChatItem[] {
  const items: ChatItem[] = [
    ...messages
      .filter(m => m.kind === 'text' && m.content)
      .map(m => ({
        kind:    'message' as const,
        id:      m.id,
        author:  m.author?.name ?? null,
        content: m.content!,
        ts:      m.ts,
      })),
    ...messages
      .filter(m => m.kind === 'voice' && m.voice_url)
      .map(m => ({
        kind:     'voice' as const,
        id:       m.id,
        author:   m.author?.name ?? null,
        voiceKey: m.voice_url!,
        ts:       m.ts,
      })),
    ...files.map(f => ({
      kind:     'file' as const,
      id:       f.id,
      author:   f.uploader?.name ?? null,
      r2Key:    f.r2_key,
      filename: f.r2_key.split('/').pop() ?? f.r2_key,
      ts:       f.ts,
    })),
  ]
  return items.sort((a, b) => a.ts.localeCompare(b.ts))
}

function FileAttachment({ r2Key, filename, lang }: { r2Key: string; filename: string; lang: LangCode }) {
  const [loading, setLoading] = useState(false)
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/r2/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: r2Key }),
      })
      const { url } = await res.json() as { url: string }
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.target = '_blank'
      a.rel = 'noopener'
      a.click()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink hover:bg-line transition-colors disabled:opacity-50"
    >
      {isImage
        ? <ImageIcon size={14} className="text-muted shrink-0" />
        : <FileText  size={14} className="text-muted shrink-0" />}
      <span className="truncate max-w-[180px]">{filename}</span>
      <Download size={12} className="text-muted shrink-0 ml-auto" />
    </button>
  )
}

function VoicePlayer({ voiceKey, lang }: { voiceKey: string; lang: LangCode }) {
  const [src,     setSrc]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (src || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/r2/download-url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key: voiceKey }),
      })
      const { url } = await res.json() as { url: string }
      setSrc(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 min-w-[180px]">
      <Mic size={13} className="text-muted shrink-0" />
      {src ? (
        <audio controls src={src} className="h-7 flex-1 min-w-0" />
      ) : (
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs text-ink2 hover:text-ink disabled:opacity-50 transition-colors"
        >
          {loading ? t(lang, 'loading') : t(lang, 'playVoiceNote')}
        </button>
      )}
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
  const supabase = createClient()
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

  const [messages,       setMessages]       = useState<JobMessage[]>(initialMessages)
  const [files,          setFiles]          = useState<JobFile[]>(chatFiles)
  const [text,           setText]           = useState('')
  const [sending,        setSending]        = useState(false)
  const [uploading,      setUploading]      = useState(false)
  const [recordState,    setRecordState]    = useState<RecordState>('idle')
  const [recordSecs,     setRecordSecs]     = useState(0)
  const [chatLocked,     setChatLocked]     = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'live' | 'error'>('connecting')
  const [fullscreen,     setFullscreen]     = useState(false)

  const cutoff = completedAt ? chatCutoff(completedAt) : null

  // Evaluated client-side only — avoids server/client timezone mismatch (hydration error)
  useEffect(() => {
    if (cutoff) setChatLocked(new Date() > cutoff)
  }, [cutoff])

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
    const channel = supabase
      .channel(`job-chat-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        payload => {
          const row = payload.new as JobMessage
          if (row.job_id !== jobId) return
          setMessages(prev =>
            prev.find(m => m.id === row.id) ? prev : [...prev, row]
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'files' },
        payload => {
          const row = payload.new as JobFile
          if (row.job_id !== jobId || row.kind !== 'attachment') return
          setFiles(prev =>
            prev.find(f => f.id === row.id) ? prev : [...prev, row]
          )
        },
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('live')
        else if (err || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error')
      })

    return () => { supabase.removeChannel(channel) }
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

  const items = toItems(messages, files)

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
                realtimeStatus === 'live'  ? 'bg-brand-green' :
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
        {items.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">{t(lang, 'noMessages')}</p>
        ) : (
          items.map(item => (
            <div key={item.id} className="space-y-0.5">
              {item.author && item.kind !== 'voice' && (
                <p className="text-xs text-muted">{item.author}</p>
              )}
              {item.kind === 'message' ? (
                <p className="text-sm text-ink bg-bg rounded-lg px-3 py-2 inline-block max-w-[85%]">
                  {item.content}
                </p>
              ) : item.kind === 'voice' ? (
                <div className="flex items-center gap-2">
                  {item.author && (
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0',
                      avatarColor(item.author),
                    )}>
                      {initials(item.author)}
                    </div>
                  )}
                  <VoicePlayer voiceKey={item.voiceKey} lang={lang} />
                </div>
              ) : (
                <FileAttachment r2Key={item.r2Key} filename={item.filename} lang={lang} />
              )}
              <p className="text-[10px] text-muted" suppressHydrationWarning>
                {new Date(item.ts).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' })}
              </p>
            </div>
          ))
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
