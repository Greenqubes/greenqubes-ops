'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import {
  Send, Paperclip, Download, FileText, Image as ImageIcon,
  Lock, Mic, StopCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { JobFile, JobMessage } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

const CHAT_OPEN_DAYS = 7

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

type RecordState = 'idle' | 'recording' | 'uploading'

interface Props {
  jobId:           string
  userId:          string
  lang:            LangCode
  completedAt:     string | null
  initialMessages: JobMessage[]
  chatFiles:       JobFile[]
}

export function ChatSection({ jobId, userId, lang, completedAt, initialMessages, chatFiles }: Props) {
  const { success: showSuccess, error: showError } = useToast()
  const supabase = createClient()
  const bottomRef        = useRef<HTMLDivElement>(null)
  const fileRef          = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])

  const [messages,       setMessages]       = useState<JobMessage[]>(initialMessages)
  const [files,          setFiles]          = useState<JobFile[]>(chatFiles)
  const [text,           setText]           = useState('')
  const [sending,        setSending]        = useState(false)
  const [uploading,      setUploading]      = useState(false)
  const [recordState,    setRecordState]    = useState<RecordState>('idle')
  const [chatLocked,     setChatLocked]     = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'live' | 'error'>('connecting')

  const cutoff = completedAt ? chatCutoff(completedAt) : null

  // Evaluated client-side only — avoids server/client timezone mismatch (hydration error)
  useEffect(() => {
    if (cutoff) setChatLocked(new Date() > cutoff)
  }, [cutoff])

  const inputDisabled = chatLocked || sending || uploading || recordState !== 'idle'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, files])

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
      return
    }
    if (recordState !== 'idle') return

    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        setRecordState('uploading')
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

          const urlRes = await fetch('/api/r2/upload-url', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ jobId, kind: 'voice', filename: `${Date.now()}.webm`, contentType: 'audio/webm' }),
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

      showSuccess(t(lang, 'savedSuccessfully'))
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setUploading(false)
    }
  }

  const items = toItems(messages, files)

  return (
    <Card className="flex flex-col overflow-hidden">
      {/* header */}
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink">{t(lang, 'jobChatTitle')}</h3>
        <div className="flex items-center gap-3">
          {cutoff && !chatLocked && (
            <span className="text-xs text-muted">
              {t(lang, 'chatOpenUntil')} {cutoff.toLocaleDateString()}
            </span>
          )}
          {chatLocked ? (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Lock size={11} />
              {t(lang, 'chatLockedTitle')}
            </span>
          ) : (
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
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[200px] max-h-[400px]">
        {items.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">{t(lang, 'noMessages')}</p>
        ) : (
          items.map(item => (
            <div key={item.id} className="space-y-0.5">
              {item.author && (
                <p className="text-xs text-muted">{item.author}</p>
              )}
              {item.kind === 'message' ? (
                <p className="text-sm text-ink bg-bg rounded-lg px-3 py-2 inline-block max-w-[85%]">
                  {item.content}
                </p>
              ) : item.kind === 'voice' ? (
                <VoicePlayer voiceKey={item.voiceKey} lang={lang} />
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

      {/* locked banner */}
      {chatLocked && (
        <div className="px-5 py-3 bg-bg border-t border-line text-sm text-muted text-center">
          {t(lang, 'chatLockedMessage')}
        </div>
      )}

      {/* input bar */}
      {!chatLocked && (
        <div className="px-4 py-3 border-t border-line flex items-center gap-2">
          <input
            type="file"
            ref={fileRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
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
            onClick={handleRecord}
            disabled={chatLocked || sending || uploading}
            title={t(lang, 'recordVoiceNote')}
            className={`shrink-0 transition-colors disabled:opacity-40 ${
              recordState === 'recording'
                ? 'text-terracotta animate-pulse'
                : recordState === 'uploading'
                  ? 'text-muted'
                  : 'text-muted hover:text-ink'
            }`}
          >
            {recordState === 'recording'
              ? <StopCircle size={16} />
              : <Mic size={16} />}
          </button>

          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            disabled={inputDisabled}
            placeholder={t(lang, 'messagePlaceholder')}
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50"
          />

          <Btn
            size="sm"
            onClick={handleSend}
            disabled={inputDisabled || !text.trim()}
          >
            <Send size={13} />
            {t(lang, 'sendMessage')}
          </Btn>
        </div>
      )}
    </Card>
  )
}
