'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Send, RotateCcw, Bot, User, ExternalLink, Sparkles,
  ChevronDown, History, Plus, Mic, Square, Home, Paperclip, X, ClipboardList, Folder,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { MAX_FILES_PER_MESSAGE, MAX_MESSAGE_BYTES, validateAttachment } from '@/lib/ai/attachments'
import type { ChatAttachment } from '@/lib/ai/attachments'
import { BottomNav } from '@/components/BottomNav'
import { NavDrawer } from '@/components/NavDrawer'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'
import { CompanyBar } from '@/components/CompanyBar'
import { HistorySidebar } from './HistorySidebar'
import { ProjectPanel } from './ProjectPanel'
import { statusLabelKey } from './statusLabels'
import { MarkdownMessage } from '@/components/MarkdownMessage'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'
import type { ProjectWithFiles } from '@/lib/supabase/queries/assistant-projects'

export interface Message {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  sources?:  { url: string; title: string }[]
  status?:   string
  streaming?: boolean
  error?:    boolean
  attachments?: ChatAttachment[]
  jobCard?:  { id: string; title: string | null }
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

type PendingAtt = ChatAttachment & { status: 'uploading' | 'ready' }

// ── Web Speech dictation (minimal local typings — lib.dom has none) ─────────

interface SpeechRecognitionEventLike {
  results: ArrayLike<{ 0: { transcript: string } }>
}
interface SpeechRecognitionLike {
  lang:            string
  continuous:      boolean
  interimResults:  boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onend:    (() => void) | null
  onerror:  (() => void) | null
  start(): void
  stop():  void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?:       SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function AssistantShell({ userName, lang, backHref, role }: Props) {
  const [messages,       setMessages]       = useState<Message[]>([])
  const [input,          setInput]          = useState('')
  const [isStreaming,    setIsStreaming]    = useState(false)
  const [activeChatId,   setActiveChatId]   = useState<string | undefined>()
  const [sidebarKey,     setSidebarKey]     = useState(0)
  const [optimisticChat, setOptimisticChat] = useState<AsstChatRow | null>(null)
  const [drawerOpen,     setDrawerOpen]     = useState(false)
  const [dictating,      setDictating]      = useState(false)
  const [micSupported,   setMicSupported]   = useState(false)
  const [pendingAtts,    setPendingAtts]    = useState<PendingAtt[]>([])

  // Projects (Phase 4)
  const [projects,        setProjects]        = useState<ProjectWithFiles[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [panelProjectId,  setPanelProjectId]  = useState<string | null>(null)

  const [showScrollDown, setShowScrollDown] = useState(false)

  const bottomRef           = useRef<HTMLDivElement>(null)
  const scrollContainerRef  = useRef<HTMLDivElement>(null)
  const inputRef            = useRef<HTMLTextAreaElement>(null)
  const messagesRef         = useRef<Message[]>([])
  const isDirtyRef          = useRef(false)
  const activeChatIdRef     = useRef<string | undefined>(undefined)
  const liveOptimisticIdRef  = useRef<string | undefined>(undefined)
  const titleGeneratedRef    = useRef(false)
  const stickToBottomRef     = useRef(true)
  const abortRef             = useRef<AbortController | null>(null)
  const recognitionRef       = useRef<SpeechRecognitionLike | null>(null)
  const fileInputRef         = useRef<HTMLInputElement>(null)
  const activeProjectIdRef   = useRef<string | null>(null)

  const { error: showAttachError } = useToast()

  const searchParams = useSearchParams()
  const chatIdParam  = searchParams.get('chat')

  useEffect(() => { setMicSupported(getSpeechRecognition() !== null) }, [])

  useEffect(() => { activeProjectIdRef.current = activeProjectId }, [activeProjectId])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant/projects')
      if (res.ok) {
        const list = await res.json() as ProjectWithFiles[]
        setProjects(list)
        // The active/panel project may have been deleted elsewhere
        setActiveProjectId(prev => prev && !list.some(p => p.id === prev) ? null : prev)
        setPanelProjectId(prev => prev && !list.some(p => p.id === prev) ? null : prev)
      }
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

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

  // Auto-load chat from ?chat=<id> (old mobile history links)
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

  // Auto-follow the stream only while the reader is at the bottom —
  // scrolling up pauses follow; the scroll-down button resumes it.
  useEffect(() => {
    const el = scrollContainerRef.current
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const saveConversation = useCallback(async (msgs: Message[], existingId?: string) => {
    const payload = msgs
      .filter(m => !m.streaming && !m.error)
      .map(m => ({
        role: m.role, content: m.content,
        ...(m.attachments?.length ? { attachments: m.attachments } : {}),
        ...(m.jobCard ? { jobCard: m.jobCard } : {}),
      }))
    if (payload.length < 2) return
    try {
      await fetch('/api/assistant/save', {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        keepalive: true,
        body:      JSON.stringify({ messages: payload, existingId, projectId: activeProjectIdRef.current }),
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
      abortRef.current?.abort()
      recognitionRef.current?.stop()
    }
  }, [saveConversation])

  function buildOptimistic(msgs: Message[], existingId?: string): AsstChatRow {
    const firstUserMsg = msgs.find(m => m.role === 'user')?.content ?? ''
    const topic = firstUserMsg.length > 50
      ? firstUserMsg.slice(0, 47) + '…'
      : firstUserMsg || 'New conversation'
    return {
      id:         existingId ?? liveOptimisticIdRef.current ?? `optimistic-${Date.now()}`,
      topic,
      msgs:       msgs.map(m => ({ role: m.role, content: m.content })) as never,
      tags:       null,
      importance: null,
      pinned:     false,
      project_id: activeProjectIdRef.current,
      ts:         new Date().toISOString(),
    }
  }

  function finishSave(msgs: Message[], existingId?: string) {
    setOptimisticChat(buildOptimistic(msgs, existingId))
    saveConversation(msgs, existingId).then(() => {
      liveOptimisticIdRef.current = undefined
      setOptimisticChat(null)
      setSidebarKey(k => k + 1)
    })
  }

  function loadFromHistory(chat: AsstChatRow) {
    if (isDirtyRef.current && messagesRef.current.length >= 2) {
      finishSave(messagesRef.current, activeChatId)
    }
    isDirtyRef.current      = false
    titleGeneratedRef.current = false
    type SavedMsg = {
      role: 'user' | 'assistant'; content: string
      attachments?: ChatAttachment[]; jobCard?: { id: string; title: string | null }
    }
    const msgs = (chat.msgs as unknown as SavedMsg[])
      .map(m => ({ id: uid(), role: m.role, content: m.content, attachments: m.attachments, jobCard: m.jobCard }))
    stickToBottomRef.current = true
    setMessages(msgs)
    setActiveChatId(chat.id)
    setActiveProjectId(chat.project_id ?? null)
    setInput('')
    setDrawerOpen(false)
  }

  function startNewChat() {
    if (isDirtyRef.current && messages.length >= 2) {
      finishSave(messages, activeChatId)
    }
    isDirtyRef.current        = false
    titleGeneratedRef.current = false
    setMessages([])
    setInput('')
    setActiveChatId(undefined)
    setActiveProjectId(null)
    setDrawerOpen(false)
    inputRef.current?.focus()
  }

  function startNewChatInProject(projectId: string) {
    startNewChat()
    setActiveProjectId(projectId)
  }

  function handleSidebarDelete(id: string) {
    if (id === activeChatId) {
      setMessages([])
      setActiveChatId(undefined)
    }
  }

  async function generateLiveTitle(userMsg: string, asstMsg: string) {
    try {
      const res = await fetch('/api/assistant/generate-title', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: [
            { role: 'user',      content: userMsg },
            { role: 'assistant', content: asstMsg },
          ],
        }),
      })
      if (!res.ok) return
      const { title } = await res.json() as { title: string }
      if (title && liveOptimisticIdRef.current) {
        setOptimisticChat(prev => prev ? { ...prev, topic: title } : prev)
      }
    } catch { /* best-effort */ }
  }

  function stopStreaming() {
    abortRef.current?.abort()
  }

  // ── Chat attachments (Phase 3) ────────────────────────────────────────────

  function handleFilesPicked(list: FileList | null) {
    if (!list?.length) return
    let count = pendingAtts.length
    let bytes = pendingAtts.reduce((s, a) => s + a.size, 0)
    for (const f of [...list]) {
      if (count >= MAX_FILES_PER_MESSAGE) { showAttachError(t(lang, 'attachTooMany')); break }
      const problem = validateAttachment(f.name, f.type, f.size)
      if (problem === 'type') { showAttachError(t(lang, 'attachUnsupported')); continue }
      if (problem === 'size') { showAttachError(t(lang, 'attachTooLarge')); continue }
      if (bytes + f.size > MAX_MESSAGE_BYTES) { showAttachError(t(lang, 'attachTotalTooLarge')); continue }
      count++; bytes += f.size
      const id = uid()
      setPendingAtts(prev => [...prev, { id, key: '', name: f.name, mime: f.type, size: f.size, status: 'uploading' }])
      void uploadScratch(id, f)
    }
  }

  async function uploadScratch(id: string, f: File) {
    try {
      const res = await fetch('/api/assistant/upload-url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filename: f.name, contentType: f.type, size: f.size }),
      })
      if (!res.ok) throw new Error()
      const { url, key } = await res.json() as { url: string; key: string }
      const put = await fetch(url, { method: 'PUT', body: f, headers: { 'Content-Type': f.type } })
      if (!put.ok) throw new Error()
      setPendingAtts(prev => prev.map(a => a.id === id ? { ...a, key, status: 'ready' } : a))
    } catch {
      showAttachError(t(lang, 'attachUploadFailed'))
      setPendingAtts(prev => prev.filter(a => a.id !== id))
    }
  }

  function removeAtt(id: string) {
    setPendingAtts(prev => prev.filter(a => a.id !== id))
    // The scratch object (if uploaded) stays in R2 — the 30-day cron removes it.
  }

  async function sendMessage() {
    const text = input.trim()
    const uploading = pendingAtts.some(a => a.status === 'uploading')
    const readyAtts = pendingAtts.filter(a => a.status === 'ready')
    if ((!text && readyAtts.length === 0) || isStreaming || uploading) return

    recognitionRef.current?.stop()
    isDirtyRef.current = true

    // First message of a brand-new chat — show "New Conversation" in sidebar immediately
    if (!activeChatId && messages.length === 0) {
      const tempId = `optimistic-${Date.now()}`
      liveOptimisticIdRef.current = tempId
      setOptimisticChat({
        id:         tempId,
        topic:      'New Conversation',
        msgs:       [] as never,
        tags:       null,
        importance: null,
        pinned:     false,
        project_id: activeProjectId,
        ts:         new Date().toISOString(),
      })
    }

    const userMsg: Message = {
      id: uid(), role: 'user', content: text,
      ...(readyAtts.length > 0
        ? { attachments: readyAtts.map(({ id, key, name, mime, size }) => ({ id, key, name, mime, size })) }
        : {}),
    }
    const asstId = uid()
    const asstMsg: Message = { id: asstId, role: 'assistant', content: '', streaming: true, status: 'thinking' }

    const next = [...messages, userMsg, asstMsg]
    stickToBottomRef.current = true
    setMessages(next)
    setInput('')
    setPendingAtts([])
    setIsStreaming(true)

    // Everything except the streaming placeholder — ends with the user message
    // just sent, attachments riding along for the route to load.
    const history = next
      .filter(m => !m.streaming)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        ...(m.attachments?.length ? { attachments: m.attachments } : {}),
      }))

    // Buffered streaming: chunks accumulate in `pending` and flush to state at
    // most once per animation frame — steady rendering instead of one re-render
    // per network chunk (the old "choppy" feel).
    let streamed = ''
    let pending  = ''
    let rafId: number | null = null
    const flush = () => {
      rafId = null
      if (!pending) return
      streamed += pending
      pending = ''
      setMessages(prev =>
        prev.map(m => m.id === asstId ? { ...m, content: streamed, status: undefined } : m),
      )
    }
    const queueText = (chunk: string) => {
      pending += chunk
      if (rafId === null) rafId = requestAnimationFrame(flush)
    }
    const setStatus = (status: Message['status']) => {
      flush()
      setMessages(prev => prev.map(m => m.id === asstId ? { ...m, status } : m))
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/assistant/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: history,
          ...(activeProjectId ? { projectId: activeProjectId } : {}),
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

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
            id?: string; title?: string | null
          }
          try { payload = JSON.parse(raw) } catch { continue }

          if (payload.type === 'text' && payload.text) {
            queueText(payload.text)
          } else if (payload.type === 'status' && payload.key) {
            setStatus(payload.key)
          } else if (payload.type === 'sources' && payload.sources) {
            flush()
            setMessages(prev =>
              prev.map(m => m.id === asstId ? { ...m, sources: payload.sources } : m),
            )
          } else if (payload.type === 'job_created' && payload.id) {
            flush()
            const jobCard = { id: payload.id, title: payload.title ?? null }
            setMessages(prev => prev.map(m => m.id === asstId ? { ...m, jobCard } : m))
          } else if (payload.type === 'error') {
            flush()
            setMessages(prev =>
              prev.map(m =>
                m.id === asstId
                  ? { ...m, content: payload.message ?? t(lang, 'assistantError'), streaming: false, status: undefined, error: true }
                  : m,
              ),
            )
          }
        }
      }

      if (rafId !== null) cancelAnimationFrame(rafId)
      flush()
      setMessages(prev => prev.map(m => m.id === asstId ? { ...m, streaming: false, status: undefined } : m))

      // Generate a live title after the first exchange in a new chat
      if (liveOptimisticIdRef.current && !titleGeneratedRef.current && streamed) {
        titleGeneratedRef.current = true
        generateLiveTitle(text, streamed)
      }
    } catch (err) {
      if (rafId !== null) cancelAnimationFrame(rafId)
      flush()
      const aborted = controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')
      if (aborted) {
        // Stopped by the user — keep the partial answer (drop the bubble if
        // empty, unless a created-job chip already landed on it)
        setMessages(prev => prev
          .map(m => m.id === asstId ? { ...m, streaming: false, status: undefined } : m)
          .filter(m => m.id !== asstId || m.content !== '' || m.jobCard !== undefined),
        )
      } else {
        setMessages(prev =>
          prev.map(m =>
            m.id === asstId
              ? { ...m, content: t(lang, 'assistantError'), streaming: false, status: undefined, error: true }
              : m,
          ),
        )
      }
    } finally {
      abortRef.current = null
      setIsStreaming(false)
    }
  }

  function toggleDictation() {
    if (dictating) {
      recognitionRef.current?.stop()
      return
    }
    const Ctor = getSpeechRecognition()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang           = lang === 'zh' ? 'zh-CN' : 'en-SG'
    rec.continuous     = true
    rec.interimResults = true
    const base = input ? input.replace(/\s+$/, '') + ' ' : ''
    rec.onresult = e => {
      let transcript = ''
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript
      setInput(base + transcript)
    }
    rec.onend   = () => { setDictating(false); recognitionRef.current = null }
    rec.onerror = () => { setDictating(false); recognitionRef.current = null }
    recognitionRef.current = rec
    setDictating(true)
    rec.start()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleScroll() {
    const el = scrollContainerRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = dist < 80
    setShowScrollDown(dist > 100)
  }

  function scrollToBottom() {
    const el = scrollContainerRef.current
    if (!el) return
    stickToBottomRef.current = true
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  const firstName = userName.split(' ')[0] || userName
  const greeting  = t(lang, 'assistantGreeting').replace('{name}', firstName)

  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) ?? null : null
  const panelProject  = panelProjectId  ? projects.find(p => p.id === panelProjectId)  ?? null : null

  return (
    <div className="h-[100dvh] bg-bg flex flex-col">

      {/* ── Company bar + sub-header (desktop only — phone gets the slim bar) ── */}
      <div className="hidden md:block">
        <CompanyBar lang={lang} role={role} />
      </div>

      <div className="hidden shrink-0 border-b border-line bg-paper px-4 py-3 md:flex items-center gap-3">
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

      {/* ── Phone: slim app-like top bar — chat-history trigger left (its
          own drawer, unrelated to site nav), site nav drawer + home right.
          This shell hides CompanyBar below md for chat real estate, so the
          R2-T5 / F1 nav drawer trigger lives here instead — NavDrawer is
          self-contained (renders its own trigger + backdrop + panel), so it
          just drops in as a second icon beside Home. The two triggers use
          distinct glyphs (History vs. NavDrawer's own Menu) — Menu now
          means "site nav" everywhere else in the app, so reusing it here
          for a different drawer read as two identical hamburgers. ── */}
      <div className="md:hidden shrink-0 border-b border-line bg-paper px-2.5 py-2 flex items-center justify-between">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
          aria-label="Chat history"
        >
          <History size={18} />
        </button>
        <div className="flex items-center gap-1">
          <NavDrawer role={role} lang={lang} />
          <Link
            href={backHref}
            className="p-2 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
            aria-label={t(lang, 'backToSchedule')}
          >
            <Home size={18} />
          </Link>
        </div>
      </div>

      {/* ── Below header: sidebar + main content side by side ── */}
      <div className="flex-1 flex overflow-hidden relative">

      {/* Sidebar (desktop) + slide-in drawer (phone) + shared modals */}
      <HistorySidebar
        activeChatId={activeChatId}
        onLoad={loadFromHistory}
        onNewChat={startNewChat}
        onDelete={handleSidebarDelete}
        refreshTrigger={sidebarKey}
        optimisticChat={optimisticChat}
        lang={lang}
        projects={projects}
        projectsLoading={projectsLoading}
        onProjectsChanged={fetchProjects}
        onNewChatInProject={startNewChatInProject}
        onOpenProjectPanel={setPanelProjectId}
        onChatMoved={(chatId, projectId) => {
          if (chatId === activeChatId) setActiveProjectId(projectId)
        }}
        drawerOpen={drawerOpen}
        onDrawerClose={() => setDrawerOpen(false)}
      />

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* ── Messages ── */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-6 relative"
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center max-w-sm mx-auto px-4">
              <p className="font-display text-2xl md:text-[28px] font-medium text-ink leading-snug">
                {greeting}
              </p>
              <p className="text-sm text-muted">{t(lang, 'assistantEmpty')}</p>
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

        {/* ── Scroll to bottom / resume follow ── */}
        {showScrollDown && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-[190px] right-4 w-9 h-9 rounded-full bg-paper border border-line shadow-md flex items-center justify-center text-ink2 hover:text-ink hover:border-ink2 transition-colors z-10"
            aria-label="Scroll to bottom"
          >
            <ChevronDown size={16} />
          </button>
        )}

        {/* ── Composer — two-row card ── */}
        <div className="shrink-0 border-t border-line bg-paper px-4 pt-3 pb-[72px]">
          <div className="max-w-2xl mx-auto">
            <div className={cn(
              'rounded-2xl border border-line bg-bg transition-colors',
              'focus-within:ring-2 focus-within:ring-terracotta/40 focus-within:border-terracotta/60',
            )}>
              {pendingAtts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
                  {pendingAtts.map(a => (
                    <span
                      key={a.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg border border-line bg-paper text-[11px] text-ink2 max-w-[200px]',
                        a.status === 'uploading' && 'opacity-60 animate-pulse',
                      )}
                    >
                      <Paperclip size={10} className="shrink-0" />
                      <span className="truncate">{a.name}</span>
                      <button
                        onClick={() => removeAtt(a.id)}
                        className="p-0.5 rounded hover:bg-line/60 text-muted hover:text-ink"
                        aria-label="Remove"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t(lang, 'writeMessage')}
                rows={1}
                className={cn(
                  'w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm text-ink placeholder:text-muted',
                  'focus:outline-none min-h-[40px] max-h-40 leading-relaxed',
                )}
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              <div className="flex items-center gap-1 px-2 pb-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  multiple
                  className="hidden"
                  onChange={e => { handleFilesPicked(e.target.files); e.target.value = '' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title={t(lang, 'attachFiles')}
                  aria-label={t(lang, 'attachFiles')}
                  className="p-2 rounded-lg text-ink2 hover:text-ink hover:bg-line/60 transition-colors"
                >
                  <Plus size={16} />
                </button>
                {activeProject && (
                  <button
                    onClick={() => setPanelProjectId(activeProject.id)}
                    title={activeProject.name}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-terracotta/40 bg-terracotta/5 text-[11px] font-medium text-terracotta hover:border-terracotta transition-colors max-w-[140px]"
                  >
                    <Folder size={11} className="shrink-0" />
                    <span className="truncate">{activeProject.name}</span>
                  </button>
                )}
                <div className="flex-1" />
                {micSupported && (
                  <button
                    onClick={toggleDictation}
                    title={t(lang, dictating ? 'stopDictation' : 'dictate')}
                    aria-label={t(lang, dictating ? 'stopDictation' : 'dictate')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      dictating
                        ? 'text-terracotta bg-terracotta/10 animate-pulse'
                        : 'text-ink2 hover:text-ink hover:bg-line/60',
                    )}
                  >
                    <Mic size={16} />
                  </button>
                )}
                {isStreaming ? (
                  <button
                    onClick={stopStreaming}
                    title={t(lang, 'stopGenerating')}
                    aria-label={t(lang, 'stopGenerating')}
                    className="shrink-0 w-9 h-9 rounded-xl bg-ink text-paper hover:bg-ink/85 flex items-center justify-center transition-colors"
                  >
                    <Square size={12} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={sendMessage}
                    disabled={
                      (!input.trim() && !pendingAtts.some(a => a.status === 'ready')) ||
                      pendingAtts.some(a => a.status === 'uploading')
                    }
                    className={cn(
                      'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                      (input.trim() || pendingAtts.some(a => a.status === 'ready')) &&
                      !pendingAtts.some(a => a.status === 'uploading')
                        ? 'bg-terracotta text-white hover:bg-terracotta/90'
                        : 'bg-line text-muted cursor-not-allowed',
                    )}
                    aria-label={t(lang, 'sendMessage')}
                  >
                    <Send size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Nav drawer (CompanyBar/slim bar above) replaces this below lg — R2-T5 / F1 */}
        <div className="hidden lg:block">
          <BottomNav role={role} />
        </div>
      </div>
      </div>

      {/* Project settings overlay (z-[70] — above the phone drawer) */}
      <ProjectPanel
        project={panelProject}
        onClose={() => setPanelProjectId(null)}
        onChanged={fetchProjects}
        lang={lang}
      />
    </div>
  )
}

// ── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({ msg, lang }: { msg: Message; lang: LangCode }) {
  const isUser = msg.role === 'user'
  const statusLabel = t(lang, statusLabelKey(msg.status))

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'shrink-0 w-7 h-7 rounded-full flex items-center justify-center border',
        isUser
          ? 'bg-brand-blue/10 border-brand-blue/20 text-brand-blue'
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
          {msg.attachments && msg.attachments.length > 0 && (
            <div className={cn('flex flex-wrap gap-1.5', msg.content && 'mb-1.5')}>
              {msg.attachments.map(a => (
                <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 text-[11px] text-white max-w-[180px]">
                  <Paperclip size={9} className="shrink-0" />
                  <span className="truncate">{a.name}</span>
                </span>
              ))}
            </div>
          )}
          {msg.content && <MarkdownMessage content={msg.content} />}
          {msg.streaming && (msg.status || !msg.content) && (
            <p className={cn('text-xs italic text-muted animate-pulse', msg.content && 'mt-1.5')}>
              {statusLabel}
            </p>
          )}
        </div>

        {/* Created-job link chip */}
        {msg.jobCard && (
          <Link
            href={`/jobs/${msg.jobCard.id}`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-terracotta/40 bg-terracotta/5 text-xs hover:border-terracotta transition-colors"
          >
            <ClipboardList size={13} className="text-terracotta shrink-0" />
            <span className="font-medium text-ink truncate max-w-[220px]">{msg.jobCard.title || 'Untitled job'}</span>
            <span className="text-muted shrink-0">{t(lang, 'assistantJobCreated')}</span>
          </Link>
        )}

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
