'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bot, X, Send, Loader2, RotateCcw, User, ExternalLink, Sparkles, Maximize2, Square } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { MarkdownMessage } from '@/components/MarkdownMessage'
import { statusLabelKey } from '@/features/assistant/statusLabels'
import type { LangCode } from '@/lib/i18n'

interface Message {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  sources?:  { url: string; title: string }[]
  status?:   string
  streaming?: boolean
  error?:    boolean
}

interface Props {
  lang: LangCode
}

function uid() {
  return Math.random().toString(36).slice(2)
}

export function FloatingChatPanel({ lang }: Props) {
  const pathname    = usePathname()
  const router      = useRouter()
  const [isOpen,        setIsOpen]        = useState(false)
  const [messages,      setMessages]      = useState<Message[]>([])
  const [input,         setInput]         = useState('')
  const [isStreaming,   setIsStreaming]   = useState(false)
  const [pendingExpand, setPendingExpand] = useState(false)

  // Navigate to /assistant once streaming finishes if expand was clicked mid-stream
  useEffect(() => {
    if (!isStreaming && pendingExpand) {
      setPendingExpand(false)
      router.push('/assistant')
    }
  }, [isStreaming, pendingExpand, router])
  const scrollRef        = useRef<HTMLDivElement>(null)
  const bottomRef        = useRef<HTMLDivElement>(null)
  const inputRef         = useRef<HTMLTextAreaElement>(null)
  const stickToBottomRef = useRef(true)
  const abortRef         = useRef<AbortController | null>(null)

  // Follow the stream only while the reader is at the bottom
  useEffect(() => {
    const el = scrollRef.current
    if (isOpen && el && stickToBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  // Keep sessionStorage in sync so AssistantShell can pick up the conversation
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('floating_chat_handoff', JSON.stringify(messages))
    } else {
      sessionStorage.removeItem('floating_chat_handoff')
    }
  }, [messages])

  const saveConversation = useCallback(async (msgs: Message[]) => {
    const payload = msgs
      .filter(m => !m.streaming && !m.error)
      .map(m => ({ role: m.role, content: m.content }))
    if (payload.length < 2) return
    try {
      await fetch('/api/assistant/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        keepalive: true, body: JSON.stringify({ messages: payload }),
      })
    } catch { /* best-effort */ }
  }, [])

  function handleClose() {
    abortRef.current?.abort()
    if (messages.length >= 2) saveConversation(messages)
    sessionStorage.removeItem('floating_chat_handoff')
    setIsOpen(false)
    setMessages([])
    setInput('')
  }

  function handleNewChat() {
    abortRef.current?.abort()
    if (messages.length >= 2) saveConversation(messages)
    sessionStorage.removeItem('floating_chat_handoff')
    setMessages([])
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function stopStreaming() {
    abortRef.current?.abort()
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: Message = { id: uid(), role: 'user',      content: text }
    const asstId = uid()
    const asstMsg: Message = { id: asstId, role: 'assistant', content: '', streaming: true, status: 'thinking' }

    const next = [...messages, userMsg, asstMsg]
    stickToBottomRef.current = true
    setMessages(next)
    setInput('')
    setIsStreaming(true)

    const history = next
      .filter(m => !m.streaming)
      .slice(0, -1)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // Buffered streaming — flush at most once per animation frame
    let streamed = ''
    let pending  = ''
    let rafId: number | null = null
    const flush = () => {
      rafId = null
      if (!pending) return
      streamed += pending
      pending = ''
      setMessages(prev => prev.map(m => m.id === asstId ? { ...m, content: streamed, status: undefined } : m))
    }
    const queueText = (chunk: string) => {
      pending += chunk
      if (rafId === null) rafId = requestAnimationFrame(flush)
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: text }] }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

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
          let payload: {
            type: string; text?: string; key?: string
            sources?: { url: string; title: string }[]; message?: string
          }
          try { payload = JSON.parse(raw) } catch { continue }

          if (payload.type === 'text' && payload.text) {
            queueText(payload.text)
          } else if (payload.type === 'status' && payload.key) {
            flush()
            const status = payload.key
            setMessages(prev => prev.map(m => m.id === asstId ? { ...m, status } : m))
          } else if (payload.type === 'sources' && payload.sources) {
            flush()
            setMessages(prev => prev.map(m => m.id === asstId ? { ...m, sources: payload.sources } : m))
          } else if (payload.type === 'error') {
            flush()
            setMessages(prev => prev.map(m =>
              m.id === asstId
                ? { ...m, content: payload.message ?? t(lang, 'assistantError'), streaming: false, status: undefined, error: true }
                : m,
            ))
          }
        }
      }

      if (rafId !== null) cancelAnimationFrame(rafId)
      flush()
      setMessages(prev => prev.map(m => m.id === asstId ? { ...m, streaming: false, status: undefined } : m))
    } catch (err) {
      if (rafId !== null) cancelAnimationFrame(rafId)
      flush()
      const aborted = controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')
      if (aborted) {
        setMessages(prev => prev
          .map(m => m.id === asstId ? { ...m, streaming: false, status: undefined } : m)
          .filter(m => m.id !== asstId || m.content !== ''),
        )
      } else {
        setMessages(prev => prev.map(m =>
          m.id === asstId
            ? { ...m, content: t(lang, 'assistantError'), streaming: false, status: undefined, error: true }
            : m,
        ))
      }
    } finally {
      abortRef.current = null
      setIsStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  // Hide on the full assistant page — it's already there
  if (pathname === '/assistant') return null

  return (
    <>
      {/* ── Floating panel ── */}
      {isOpen && (
        <div className={cn(
          'fixed right-4 z-[70] flex flex-col rounded-2xl border border-line bg-paper shadow-xl',
          'w-[min(340px,calc(100vw-2rem))]',
          'bottom-[180px]',      // panel bottom clears bubble at 120px (120 + 48 + 12 = 180)
          'max-h-[min(520px,calc(100vh-160px))]',
        )}>
          {/* Header */}
          <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-line">
            <div className="w-7 h-7 rounded-full bg-terracotta flex items-center justify-center">
              <Sparkles size={13} className="text-white" />
            </div>
            <p className="flex-1 font-display text-[13px] font-medium text-ink leading-none">
              {t(lang, 'assistant')}
            </p>
            <button
              onClick={() => isStreaming ? setPendingExpand(true) : router.push('/assistant')}
              className="p-1.5 rounded-lg text-muted hover:text-ink2 hover:bg-bg transition-colors"
              title={isStreaming ? 'Opening after reply…' : 'Open full assistant'}
            >
              {pendingExpand
                ? <Loader2 size={13} className="animate-spin" />
                : <Maximize2 size={13} />
              }
            </button>
            {messages.length > 0 && (
              <button
                onClick={handleNewChat}
                className="p-1.5 rounded-lg text-muted hover:text-ink2 hover:bg-bg transition-colors"
                title={t(lang, 'newChat')}
              >
                <RotateCcw size={13} />
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-muted hover:text-ink2 hover:bg-bg transition-colors"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0 px-3 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 text-center py-8">
                <div className="w-10 h-10 rounded-xl bg-terracotta/10 border border-terracotta/20 flex items-center justify-center">
                  <Bot size={18} className="text-terracotta" />
                </div>
                <p className="text-xs text-muted max-w-[200px]">{t(lang, 'assistantEmpty')}</p>
              </div>
            ) : (
              messages.map(msg => <FloatingBubble key={msg.id} msg={msg} lang={lang} />)
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-line px-3 py-2.5">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t(lang, 'writeMessage')}
                rows={1}
                className={cn(
                  'flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2 text-[13px] text-ink placeholder:text-muted',
                  'focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60',
                  'transition-colors min-h-[36px] max-h-28 leading-relaxed',
                )}
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  title={t(lang, 'stopGenerating')}
                  aria-label={t(lang, 'stopGenerating')}
                  className="shrink-0 w-9 h-9 rounded-xl bg-ink text-paper hover:bg-ink/85 flex items-center justify-center transition-colors"
                >
                  <Square size={11} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className={cn(
                    'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                    input.trim()
                      ? 'bg-terracotta text-white hover:bg-terracotta/90'
                      : 'bg-line text-muted cursor-not-allowed',
                  )}
                  aria-label={t(lang, 'sendMessage')}
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bubble trigger ── */}
      <button
        onClick={() => (isOpen ? handleClose() : setIsOpen(true))}
        className={cn(
          'fixed right-4 bottom-[120px] z-[60] w-12 h-12 rounded-full shadow-lg',
          'flex items-center justify-center transition-all duration-200',
          isOpen
            ? 'bg-ink text-paper hover:bg-ink/90'
            : 'bg-terracotta text-white hover:bg-terracotta/90',
        )}
        aria-label={isOpen ? 'Close assistant' : 'Open assistant'}
      >
        {isOpen ? <X size={20} /> : <Bot size={20} />}
      </button>
    </>
  )
}

function FloatingBubble({ msg, lang }: { msg: Message; lang: LangCode }) {
  const isUser = msg.role === 'user'
  const statusLabel = t(lang, statusLabelKey(msg.status))

  return (
    <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'shrink-0 w-6 h-6 rounded-full flex items-center justify-center border',
        isUser
          ? 'bg-blue/10 border-blue/20 text-blue'
          : 'bg-terracotta/10 border-terracotta/20 text-terracotta',
      )}>
        {isUser ? <User size={11} /> : <Bot size={11} />}
      </div>
      <div className={cn('max-w-[80%] space-y-1.5', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'rounded-2xl px-3 py-2 text-xs leading-relaxed',
          isUser
            ? 'bg-terracotta text-white rounded-tr-sm'
            : msg.error
              ? 'bg-paper border border-line text-ink2 rounded-tl-sm'
              : 'bg-bg border border-line text-ink rounded-tl-sm',
        )}>
          {msg.content && <MarkdownMessage content={msg.content} />}
          {msg.streaming && (msg.status || !msg.content) && (
            <p className={cn('text-[11px] italic text-muted animate-pulse', msg.content && 'mt-1')}>
              {statusLabel}
            </p>
          )}
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {msg.sources.map((src, i) => (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-line bg-paper text-[10px] text-ink2 hover:border-ink2 transition-colors"
              >
                <ExternalLink size={9} className="shrink-0" />
                <span className="truncate max-w-[140px]">{src.title || src.url}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
