'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Send, RotateCcw, Bot, User, Loader2,
  ExternalLink, Sparkles, History,
} from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'
import { HistorySidebar } from './HistorySidebar'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'

interface Message {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  sources?:  { url: string; title: string }[]
  streaming?: boolean
  error?:    boolean
}

interface Props {
  userName: string
  role:     Role
  lang:     LangCode
  backHref: string
}

function uid() {
  return Math.random().toString(36).slice(2)
}

export function AssistantShell({ lang, backHref, role }: Props) {
  const [messages,     setMessages]     = useState<Message[]>([])
  const [input,        setInput]        = useState('')
  const [isStreaming,  setIsStreaming]  = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | undefined>()
  const [sidebarKey,   setSidebarKey]   = useState(0)

  const bottomRef       = useRef<HTMLDivElement>(null)
  const inputRef        = useRef<HTMLTextAreaElement>(null)
  const messagesRef     = useRef<Message[]>([])
  const isDirtyRef      = useRef(false)
  const activeChatIdRef = useRef<string | undefined>(undefined)

  const searchParams = useSearchParams()
  const chatIdParam  = searchParams.get('chat')

  // Pick up any conversation started in the floating chat panel
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('floating_chat_handoff')
      if (stored) {
        const msgs = JSON.parse(stored) as Message[]
        if (msgs.length > 0) setMessages(msgs)
        sessionStorage.removeItem('floating_chat_handoff')
      }
    } catch { /* ignore parse errors */ }
  }, [])

  // Auto-load chat from ?chat=<id> (mobile history navigation)
  useEffect(() => {
    if (!chatIdParam) return
    fetch('/api/assistant/history')
      .then(r => r.json())
      .then((chats: AsstChatRow[]) => {
        const found = chats.find(c => c.id === chatIdParam)
        if (found) loadFromHistory(found)
      })
      .catch(() => { /* best-effort */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIdParam])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const saveConversation = useCallback(async (msgs: Message[], existingId?: string) => {
    const payload = msgs
      .filter(m => !m.streaming && !m.error)
      .map(m => ({ role: m.role, content: m.content }))
    if (payload.length < 2) return
    try {
      await fetch('/api/assistant/save', {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        keepalive: true,
        body:      JSON.stringify({ messages: payload, existingId }),
      })
    } catch {
      // best-effort; don't surface to user
    }
  }, [])

  useEffect(() => { messagesRef.current    = messages    }, [messages])
  useEffect(() => { activeChatIdRef.current = activeChatId }, [activeChatId])

  // Save on unmount only if the user typed new messages in this session
  useEffect(() => {
    return () => {
      if (isDirtyRef.current) saveConversation(messagesRef.current, activeChatIdRef.current)
    }
  }, [saveConversation])

  function loadFromHistory(chat: AsstChatRow) {
    if (isDirtyRef.current && messagesRef.current.length >= 2) {
      saveConversation(messagesRef.current, activeChatId).then(() => setSidebarKey(k => k + 1))
    }
    isDirtyRef.current = false
    const msgs = (chat.msgs as { role: 'user' | 'assistant'; content: string }[])
      .map(m => ({ id: uid(), role: m.role, content: m.content }))
    setMessages(msgs)
    setActiveChatId(chat.id)
    setInput('')
  }

  function startNewChat() {
    if (isDirtyRef.current && messages.length >= 2) {
      saveConversation(messages, activeChatId).then(() => setSidebarKey(k => k + 1))
    }
    isDirtyRef.current = false
    setMessages([])
    setInput('')
    setActiveChatId(undefined)
    inputRef.current?.focus()
  }

  function handleSidebarDelete(id: string) {
    if (id === activeChatId) {
      setMessages([])
      setActiveChatId(undefined)
    }
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || isStreaming) return

    isDirtyRef.current = true

    const userMsg: Message = { id: uid(), role: 'user', content: text }
    const asstId = uid()
    const asstMsg: Message = { id: asstId, role: 'assistant', content: '', streaming: true }

    const next = [...messages, userMsg, asstMsg]
    setMessages(next)
    setInput('')
    setIsStreaming(true)

    const history = next
      .filter(m => !m.streaming)
      .slice(0, -1)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    try {
      const res = await fetch('/api/assistant/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: [...history, { role: 'user', content: text }],
        }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''
      let   finalContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const raw = part.slice(6).trim()
          if (!raw) continue

          let payload: { type: string; text?: string; sources?: { url: string; title: string }[]; message?: string }
          try { payload = JSON.parse(raw) } catch { continue }

          if (payload.type === 'text' && payload.text) {
            finalContent += payload.text
            setMessages(prev =>
              prev.map(m =>
                m.id === asstId ? { ...m, content: finalContent } : m,
              ),
            )
          } else if (payload.type === 'sources' && payload.sources) {
            setMessages(prev =>
              prev.map(m =>
                m.id === asstId ? { ...m, sources: payload.sources } : m,
              ),
            )
          } else if (payload.type === 'error') {
            setMessages(prev =>
              prev.map(m =>
                m.id === asstId
                  ? { ...m, content: payload.message ?? t(lang, 'assistantError'), streaming: false, error: true }
                  : m,
              ),
            )
          }
        }
      }

      setMessages(prev => prev.map(m => m.id === asstId ? { ...m, streaming: false } : m))
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === asstId
            ? { ...m, content: t(lang, 'assistantError'), streaming: false, error: true }
            : m,
        ),
      )
    } finally {
      setIsStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="h-[100dvh] bg-bg flex">

      {/* ── Sidebar (desktop only, manages its own hidden md:flex) ── */}
      <HistorySidebar
        activeChatId={activeChatId}
        onLoad={loadFromHistory}
        onNewChat={startNewChat}
        onDelete={handleSidebarDelete}
        refreshTrigger={sidebarKey}
      />

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="shrink-0 border-b border-line bg-paper px-4 py-3 flex items-center gap-3">
          <Link
            href={backHref}
            className="p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
            aria-label={t(lang, 'backToSchedule')}
          >
            <ArrowLeft size={16} />
          </Link>

          <div className="shrink-0 w-8 h-8 rounded-full bg-terracotta flex items-center justify-center">
            <Sparkles size={15} className="text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-[15px] font-medium text-ink leading-none">
              {t(lang, 'assistant')}
            </h1>
            <p className="text-[10px] text-muted mt-0.5">{t(lang, 'assistantSubtitle')}</p>
          </div>

          {/* Mobile — History button (hidden on desktop where sidebar is visible) */}
          <Link
            href="/assistant/history"
            className="md:hidden p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
            aria-label="Conversation history"
          >
            <History size={16} />
          </Link>

          {messages.length > 0 && (
            <button
              onClick={startNewChat}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-bg text-ink2 hover:border-ink2 text-xs font-medium transition-colors shrink-0"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">{t(lang, 'newChat')}</span>
            </button>
          )}
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-terracotta/10 border border-terracotta/20 flex items-center justify-center">
                <Bot size={22} className="text-terracotta" />
              </div>
              <div>
                <p className="font-display text-lg font-medium text-ink">
                  {t(lang, 'assistant')}
                </p>
                <p className="text-sm text-muted mt-1">{t(lang, 'assistantEmpty')}</p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-5">
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} lang={lang} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div className="shrink-0 border-t border-line bg-paper px-4 pt-3 pb-[72px]">
          <div className="max-w-2xl mx-auto flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t(lang, 'askPlaceholder')}
              rows={1}
              disabled={isStreaming}
              className={cn(
                'flex-1 resize-none rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted',
                'focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60',
                'transition-colors min-h-[42px] max-h-40 leading-relaxed',
                'disabled:opacity-50',
              )}
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className={cn(
                'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                input.trim() && !isStreaming
                  ? 'bg-terracotta text-white hover:bg-terracotta/90'
                  : 'bg-line text-muted cursor-not-allowed',
              )}
              aria-label={t(lang, 'sendMessage')}
            >
              {isStreaming
                ? <Loader2 size={16} className="animate-spin" />
                : <Send size={16} />
              }
            </button>
          </div>
        </div>

        <BottomNav role={role} />
      </div>
    </div>
  )
}

// ── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({ msg, lang }: { msg: Message; lang: LangCode }) {
  const isUser = msg.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'shrink-0 w-7 h-7 rounded-full flex items-center justify-center border',
        isUser
          ? 'bg-blue/10 border-blue/20 text-blue'
          : 'bg-terracotta/10 border-terracotta/20 text-terracotta',
      )}>
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>

      {/* Bubble */}
      <div className={cn('max-w-[78%] space-y-2', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-terracotta text-white rounded-tr-sm'
            : msg.error
              ? 'bg-paper border border-line text-ink2 rounded-tl-sm'
              : 'bg-paper border border-line text-ink rounded-tl-sm',
        )}>
          {msg.content
            ? <p className="whitespace-pre-wrap">{msg.content}</p>
            : msg.streaming && (
              <span className="inline-flex items-center gap-1 text-muted text-xs">
                <Loader2 size={12} className="animate-spin" />
                {lang === 'zh' ? '思考中…' : lang === 'bn' ? 'ভাবছি…' : 'Thinking…'}
              </span>
            )
          }
        </div>

        {/* Sources */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted uppercase tracking-widest px-1">
              {t(lang, 'assistantSources')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {msg.sources.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-line bg-paper text-[11px] text-ink2 hover:border-ink2 hover:text-ink transition-colors"
                >
                  <ExternalLink size={10} className="shrink-0" />
                  <span className="truncate max-w-[180px]">{src.title || src.url}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
