'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ClipboardList, Keyboard, Mic, MicOff, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { statusLabelKey } from '@/features/assistant/statusLabels'
import { useVoiceSession } from './useVoiceSession'
import type { LangCode } from '@/lib/i18n'

interface Props {
  lang:    LangCode
  onClose: () => void
}

// Full-screen voice mode. Portalled to document.body (CompanyBar's sticky
// z-30 root would trap a nested overlay under the z-[59]/[60] FABs) at
// z-[75] — above panels/drawers (z-[70]), below the bug modal + tour (z-[80]).
// Deliberately covers the BottomNav: it is a modal full-screen mode, nothing
// interactive sits BEHIND it half-visible.
export function VoiceModeOverlay({ lang, onClose }: Props) {
  const session = useVoiceSession(lang)
  const [mounted,    setMounted]    = useState(false)
  const [showTyping, setShowTyping] = useState(false)
  const [typed,      setTyped]      = useState('')
  const scrollRef   = useRef<HTMLDivElement>(null)
  const startedRef  = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  // start() must run in the same task as the opening tap (iOS TTS unlock).
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    session.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lock body scroll while the overlay is up.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [session.turns, session.streamingText, session.liveTranscript])

  const close = () => {
    session.shutdown()
    onClose()
  }

  const sendTyped = () => {
    const text = typed.trim()
    if (!text) return
    setTyped('')
    session.sendTyped(text)
  }

  const noStt      = !session.supported.stt
  const showInput  = showTyping || noStt || session.micDenied
  const lastTurn   = session.turns[session.turns.length - 1]
  const jobCard    = lastTurn?.role === 'assistant' ? lastTurn.jobCard : undefined
  const responding = session.phase === 'responding'

  const statusLine = (() => {
    if (session.micDenied)  return t(lang, 'voiceMicDenied')
    if (noStt)              return t(lang, 'voiceUnsupported')
    if (responding) {
      if (session.statusKey)  return t(lang, statusLabelKey(session.statusKey))
      if (session.isSpeaking) return t(lang, 'voiceSpeaking')
      return t(lang, 'assistantThinking')
    }
    if (session.phase === 'muted')     return t(lang, 'voiceMutedLabel')
    if (session.phase === 'tapToTalk') return t(lang, 'voiceTapToTalk')
    return t(lang, 'voiceListening')
  })()

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[75] flex flex-col items-center bg-ink/95 text-paper">
      {/* Top bar */}
      <div className="w-full max-w-md flex items-center justify-between px-5 pt-5">
        <p className="font-display text-sm font-medium text-paper/80">{t(lang, 'voiceAssistant')}</p>
        <button
          onClick={close}
          aria-label={t(lang, 'voiceClose')}
          className="p-2 rounded-full text-paper/70 hover:text-paper hover:bg-paper/10 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Orb */}
      <div className="shrink-0 flex flex-col items-center gap-4 pt-6 pb-2">
        <div className="relative w-36 h-36 flex items-center justify-center">
          {session.phase === 'listening' && (
            <span className="absolute inset-0 rounded-full bg-[var(--lime)]/30 animate-ping" />
          )}
          {session.phase === 'tapToTalk' ? (
            <button
              onClick={session.tapTalk}
              className="relative w-36 h-36 rounded-full bg-terracotta flex items-center justify-center shadow-xl hover:bg-terracotta/90 transition-colors"
              aria-label={t(lang, 'voiceTapToTalk')}
            >
              <Mic size={48} className="text-white" />
            </button>
          ) : (
            <div className={cn(
              'relative w-36 h-36 rounded-full flex items-center justify-center shadow-xl transition-colors duration-300',
              session.phase === 'muted' && 'bg-ink2',
              responding && !session.isSpeaking && 'bg-blue animate-pulse',
              responding && session.isSpeaking && 'bg-terracotta animate-pulse',
              session.phase === 'listening' && 'bg-terracotta',
            )}>
              {session.phase === 'muted'
                ? <MicOff size={48} className="text-white/80" />
                : <Mic size={48} className="text-white" />}
            </div>
          )}
        </div>
        <p className={cn('text-sm px-6 text-center', session.errorKey ? 'text-[#f2b8b5]' : 'text-paper/70')}>
          {session.errorKey ? t(lang, 'voiceError') : statusLine}
        </p>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 min-h-0 w-full max-w-md overflow-y-auto px-6 py-4 space-y-3">
        {session.turns.length === 0 && !session.streamingText && !session.liveTranscript && (
          <p className="text-center text-paper/50 text-sm leading-relaxed pt-4">{t(lang, 'voiceHint')}</p>
        )}
        {session.turns.map(turn => (
          <div key={turn.id} className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
              turn.role === 'user' ? 'bg-terracotta text-white rounded-tr-sm' : 'bg-paper/10 text-paper rounded-tl-sm',
            )}>
              {turn.content}
            </div>
          </div>
        ))}
        {session.streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-paper/10 text-paper">
              {session.streamingText}
            </div>
          </div>
        )}
        {session.liveTranscript && (
          <div className="flex justify-end">
            <p className="max-w-[85%] text-sm italic text-paper/50 text-right">{session.liveTranscript}</p>
          </div>
        )}
        {jobCard && (
          <div className="flex justify-start">
            <Link
              href={`/jobs/${jobCard.id}`}
              onClick={close}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--lime)]/50 bg-[var(--lime)]/10 text-sm hover:border-[var(--lime)] transition-colors"
            >
              <ClipboardList size={15} className="text-[var(--lime)] shrink-0" />
              <span className="font-medium text-paper truncate max-w-[200px]">{jobCard.title || 'Untitled job'}</span>
              <span className="text-paper/60 shrink-0">{t(lang, 'assistantJobCreated')}</span>
            </Link>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="shrink-0 w-full max-w-md px-6 pb-8 pt-2 space-y-3">
        {showInput && (
          <div className="flex gap-2 items-end">
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendTyped() } }}
              placeholder={t(lang, 'voiceTypeInstead')}
              className="flex-1 rounded-xl border border-paper/20 bg-paper/10 px-4 py-2.5 text-sm text-paper placeholder:text-paper/40 focus:outline-none focus:ring-2 focus:ring-[var(--lime)]/40"
            />
            <button
              onClick={sendTyped}
              disabled={!typed.trim()}
              aria-label={t(lang, 'sendMessage')}
              className={cn(
                'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                typed.trim() ? 'bg-terracotta text-white hover:bg-terracotta/90' : 'bg-paper/10 text-paper/40 cursor-not-allowed',
              )}
            >
              <Send size={16} />
            </button>
          </div>
        )}
        <div className="flex items-center justify-center gap-6">
          {!noStt && (
            <button
              onClick={session.phase === 'muted' ? session.unmute : session.mute}
              aria-label={t(lang, session.phase === 'muted' ? 'voiceUnmute' : 'voiceMute')}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
                session.phase === 'muted'
                  ? 'bg-paper/20 text-paper hover:bg-paper/30'
                  : 'bg-paper/10 text-paper/80 hover:bg-paper/20',
              )}
            >
              {session.phase === 'muted' ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
          )}
          {!noStt && (
            <button
              onClick={() => setShowTyping(v => !v)}
              aria-label={t(lang, 'voiceTypeInstead')}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
                showTyping ? 'bg-paper/20 text-paper' : 'bg-paper/10 text-paper/60 hover:bg-paper/20',
              )}
            >
              <Keyboard size={22} />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
