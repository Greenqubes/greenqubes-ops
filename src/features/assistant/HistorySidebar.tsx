// src/features/assistant/HistorySidebar.tsx
'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, Trash2, X, Brain } from 'lucide-react'
import { HistoryList } from './HistoryList'
import { MemoryView } from './MemoryView'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'

interface Props {
  activeChatId?:   string
  onLoad:          (chat: AsstChatRow) => void
  onNewChat:       () => void
  onDelete:        (id: string) => void
  refreshTrigger?: number
  optimisticChat?: AsstChatRow | null
  lang:            LangCode
  /** Phone slide-in drawer (replaces the old /assistant/history route) */
  drawerOpen?:     boolean
  onDrawerClose?:  () => void
}

function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="px-3 py-2 space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3 rounded bg-line/80" style={{ width: `${68 - (i % 3) * 14}%` }} />
        </div>
      ))}
    </div>
  )
}

export function HistorySidebar({
  activeChatId, onLoad, onNewChat, onDelete, refreshTrigger, optimisticChat,
  lang, drawerOpen = false, onDrawerClose,
}: Props) {
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [chats,             setChats]             = useState<AsstChatRow[]>([])
  const [loading,           setLoading]           = useState(true)
  const [toast,             setToast]             = useState<string | null>(null)
  const [pendingDeleteId,   setPendingDeleteId]   = useState<string | null>(null)
  const [isSelecting,       setIsSelecting]       = useState(false)
  const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set())
  const [bulkDeletePending, setBulkDeletePending] = useState(false)
  const [renameState,       setRenameState]       = useState<{ id: string; topic: string } | null>(null)
  const [renameInput,       setRenameInput]       = useState('')

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const displayChats = useMemo(() => {
    if (!optimisticChat) return chats
    const existingIdx = chats.findIndex(c => c.id === optimisticChat.id)
    if (existingIdx !== -1) {
      return chats.map((c, i) => i === existingIdx ? optimisticChat : c)
    }
    return [optimisticChat, ...chats]
  }, [chats, optimisticChat])

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant/history')
      if (res.ok) setChats(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchChats() }, [fetchChats, refreshTrigger])

  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }
  }, [])

  function showToast(msg: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  function exitSelectMode() {
    setIsSelecting(false)
    setSelectedIds(new Set())
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleRename(id: string, currentTopic: string) {
    setRenameState({ id, topic: currentTopic })
    setRenameInput(currentTopic)
  }

  async function confirmRename() {
    const state = renameState
    if (!state) return
    const newTopic = renameInput.trim()
    if (!newTopic) return
    setRenameState(null)

    setChats(prev => prev.map(c => c.id === state.id ? { ...c, topic: newTopic } : c))

    const res = await fetch('/api/assistant/rename', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: state.id, topic: newTopic }),
    })
    if (!res.ok) fetchChats()
  }

  async function handlePin(id: string, pinned: boolean) {
    setChats(prev => prev.map(c => c.id === id ? { ...c, pinned } : c))

    const res = await fetch('/api/assistant/pin', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, pinned }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setChats(prev => prev.map(c => c.id === id ? { ...c, pinned: !pinned } : c))
      if (body?.reason === 'pin_cap') {
        showToast('You can pin up to 5 conversations')
      }
    }
  }

  async function confirmDelete() {
    const id = pendingDeleteId
    if (!id) return
    setPendingDeleteId(null)

    setChats(prev => prev.filter(c => c.id !== id))
    onDelete(id)

    const res = await fetch('/api/assistant/delete', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })

    if (!res.ok) fetchChats()
  }

  async function confirmBulkDelete() {
    const ids = [...selectedIds]
    setBulkDeletePending(false)
    exitSelectMode()

    setChats(prev => prev.filter(c => !ids.includes(c.id)))
    ids.forEach(id => onDelete(id))

    const results = await Promise.all(
      ids.map(id => fetch('/api/assistant/delete', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      }))
    )

    if (results.some(r => !r.ok)) fetchChats()
  }

  const selectedCount = selectedIds.size

  const newChatButton = (
    <button
      onClick={onNewChat}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-terracotta hover:bg-terracotta/10 text-sm font-medium transition-colors"
    >
      <span className="w-6 h-6 rounded-full bg-terracotta text-white flex items-center justify-center">
        <Plus size={13} strokeWidth={2.5} />
      </span>
      New chat
    </button>
  )

  const memoryButton = (
    <button
      onClick={() => { setMemoryOpen(true); onDrawerClose?.() }}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-ink2 hover:bg-bg text-sm font-medium transition-colors"
    >
      <span className="w-6 h-6 rounded-full border border-line flex items-center justify-center">
        <Brain size={13} />
      </span>
      {t(lang, 'memory')}
    </button>
  )

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col shrink-0 w-[260px] border-r border-line bg-paper h-full overflow-hidden">
        {/* New chat — top of the sidebar, Claude-style */}
        <div className="shrink-0 px-2 pt-3 pb-1">
          {newChatButton}
          {memoryButton}
        </div>

        {/* Header */}
        <div className="shrink-0 px-4 pt-2 pb-1 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Chats</p>
          {isSelecting ? (
            <button
              onClick={exitSelectMode}
              className="text-[11px] font-medium text-ink2 hover:text-ink transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setIsSelecting(true)}
              className="text-[11px] font-medium text-ink2 hover:text-ink transition-colors"
            >
              Select
            </button>
          )}
        </div>

        {/* List */}
        <div className={cn('flex-1 overflow-y-auto px-1 py-1', (!isSelecting || selectedCount === 0) && 'pb-[80px]')}>
          {loading && !optimisticChat ? (
            <SkeletonRows />
          ) : displayChats.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted text-center">No conversations yet</p>
          ) : (
            <HistoryList
              chats={displayChats}
              activeChatId={activeChatId}
              onLoad={onLoad}
              onPin={handlePin}
              onDelete={setPendingDeleteId}
              onRename={handleRename}
              isSelecting={isSelecting}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-[120px] left-2 right-2 px-3 py-2 bg-ink text-paper text-xs rounded-lg shadow-md text-center">
            {toast}
          </div>
        )}

        {/* Bulk delete bar */}
        {isSelecting && selectedCount > 0 && (
          <div className="shrink-0 px-3 pt-2 pb-[80px] border-t border-line">
            <button
              onClick={() => setBulkDeletePending(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 transition-colors"
            >
              <Trash2 size={13} />
              Delete {selectedCount} {selectedCount === 1 ? 'conversation' : 'conversations'}
            </button>
          </div>
        )}
      </aside>

      {/* ── Phone drawer — left slide-in above BottomNav (z-[60]+, hard rule) ── */}
      <div className={cn('md:hidden fixed inset-0 z-[60]', !drawerOpen && 'pointer-events-none')}>
        {/* Backdrop */}
        <div
          onClick={onDrawerClose}
          className={cn(
            'absolute inset-0 bg-ink/40 transition-opacity duration-200',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
        />
        {/* Panel */}
        <div className={cn(
          'absolute inset-y-0 left-0 w-[290px] max-w-[85vw] bg-paper border-r border-line flex flex-col',
          'transition-transform duration-200 ease-out',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        )}>
          {/* Branding */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/greenqubes-logo.png" alt="GreenQubes" className="brand-logo h-5 w-auto" />
            <button
              onClick={onDrawerClose}
              className="p-1.5 -mr-1 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>

          {/* New chat + Memory */}
          <div className="shrink-0 px-2 pt-3 pb-1">
            {newChatButton}
            {memoryButton}
          </div>

          {/* Chats */}
          <p className="shrink-0 px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted">Chats</p>
          <div className="flex-1 overflow-y-auto px-1 py-1">
            {loading && !optimisticChat ? (
              <SkeletonRows />
            ) : displayChats.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted text-center">No conversations yet</p>
            ) : (
              <HistoryList
                chats={displayChats}
                activeChatId={activeChatId}
                onLoad={onLoad}
                onPin={handlePin}
                onDelete={setPendingDeleteId}
                onRename={handleRename}
                mobile
              />
            )}
          </div>
        </div>
      </div>

      {/* Single-delete modal */}
      <Modal
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
      >
        <p className="font-display text-base font-medium text-ink mb-1">Delete Permanently?</p>
        <p className="text-sm text-ink2 mb-5">This conversation will be removed and cannot be recovered.</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setPendingDeleteId(null)}
            className="px-4 py-2 rounded-xl border border-line text-ink2 text-sm font-medium hover:border-ink2 transition-colors"
          >
            No
          </button>
          <button
            onClick={confirmDelete}
            className="px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 transition-colors"
          >
            Yes
          </button>
        </div>
      </Modal>

      {/* Bulk delete modal */}
      <Modal
        isOpen={bulkDeletePending}
        onClose={() => setBulkDeletePending(false)}
      >
        <p className="font-display text-base font-medium text-ink mb-1">Delete {selectedCount} {selectedCount === 1 ? 'Conversation' : 'Conversations'}?</p>
        <p className="text-sm text-ink2 mb-5">These conversations will be permanently removed and cannot be recovered.</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setBulkDeletePending(false)}
            className="px-4 py-2 rounded-xl border border-line text-ink2 text-sm font-medium hover:border-ink2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirmBulkDelete}
            className="px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 transition-colors"
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* Memory manager overlay (z-[70] — above the phone drawer) */}
      <MemoryView open={memoryOpen} onClose={() => setMemoryOpen(false)} lang={lang} />

      {/* Rename modal */}
      <Modal
        isOpen={renameState !== null}
        onClose={() => setRenameState(null)}
      >
        <p className="font-display text-base font-medium text-ink mb-3">Rename conversation</p>
        <input
          value={renameInput}
          onChange={e => setRenameInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmRename() }}
          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60 mb-4"
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setRenameState(null)}
            className="px-4 py-2 rounded-xl border border-line text-ink2 text-sm font-medium hover:border-ink2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirmRename}
            disabled={!renameInput.trim()}
            className="px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>
      </Modal>
    </>
  )
}
