'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Bot, X, Send, Loader2, RotateCcw, User, ExternalLink, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'

interface Message {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  sources?:  { url: string; title: string }[]
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
  const [isOpen,       setIsOpen]       = useState(false)
  const [messages,     setMessages]     = useState<Message[]>([])
  const [input,        setInput]        = useState('')
  const [isStreaming,  setIsStreaming]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

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
    if (messages.length >= 2) saveConversation(messages)
    sessionStorage.removeItem('floating_chat_handoff')
    setIsOpen(false)
    setMessages([])
    setInput('')
  }

  function handleNewChat() {
    if (messages.length >= 2) saveConversation(messages)
    sessionStorage.removeItem('floating_chat_handoff')
    setMessages([])
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: Message = { id: uid(), role: 'user',      content: text }
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: text }] }),
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalContent = ''

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
            setMessages(prev => prev.map(m => m.id === asstId ? { ...m, content: finalContent } : m))
          } else if (payload.type === 'sources' && payload.sources) {
            setMessages(prev => prev.map(m => m.id === asstId ? { ...m, sources: payload.sources } : m))
          } else if (payload.type === 'error') {
            setMessages(prev => prev.map(m =>
              m.id === asstId
                ? { ...m, content: payload.message ?? t(lang, 'assistantError'), streaming: false, error: true }
                : m,
            ))
          }
        }
      }

      setMessages(prev => {
        const finalised = prev.map(m => m.id === asstId ? { ...m, streaming: false } : m)
        saveConversation(finalised)
        return finalised
      })
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === asstId
          ? { ...m, content: t(lang, 'assistantError'), streaming: false, error: true }
          : m,
      ))
    } finally {
      setIsStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
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
          'bottom-36',           // panel bottom = 144px — 16px above bubble top (80px + 48px)
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
          <div className="flex-1 overflow-y-auto min-h-0 px-3 py-4 space-y-4">
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
                placeholder={t(lang, 'askPlaceholder')}
                rows={1}
                disabled={isStreaming}
                className={cn(
                  'flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2 text-[13px] text-ink placeholder:text-muted',
                  'focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60',
                  'transition-colors min-h-[36px] max-h-28 leading-relaxed disabled:opacity-50',
                )}
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className={cn(
                  'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                  input.trim() && !isStreaming
                    ? 'bg-terracotta text-white hover:bg-terracotta/90'
                    : 'bg-line text-muted cursor-not-allowed',
                )}
                aria-label={t(lang, 'sendMessage')}
              >
                {isStreaming
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Send size={14} />
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bubble trigger ── */}
      <button
        onClick={() => (isOpen ? handleClose() : setIsOpen(true))}
        className={cn(
          'fixed right-4 bottom-20 z-[60] w-12 h-12 rounded-full shadow-lg',
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
          {msg.content
            ? <p className="whitespace-pre-wrap">{msg.content}</p>
            : msg.streaming && (
              <span className="inline-flex items-center gap-1 text-muted">
                <Loader2 size={11} className="animate-spin" />
                {lang === 'zh' ? '思考中…' : lang === 'bn' ? 'ভাবছি…' : 'Thinking…'}
              </span>
            )
          }
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
