// src/features/assistant/HistorySidebar.tsx
'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { PlusCircle, Loader2, Trash2 } from 'lucide-react'
import { HistoryList } from './HistoryList'
import { Modal } from '@/components/Modal'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'

interface Props {
  activeChatId?:   string
  onLoad:          (chat: AsstChatRow) => void
  onNewChat:       () => void
  onDelete:        (id: string) => void
  refreshTrigger?: number
  optimisticChat?: AsstChatRow | null
}

export function HistorySidebar({ activeChatId, onLoad, onNewChat, onDelete, refreshTrigger, optimisticChat }: Props) {
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

  return (
    <>
      <aside className="hidden md:flex flex-col shrink-0 w-[260px] border-r border-line bg-paper h-full overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">History</p>
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
        <div className="flex-1 overflow-y-auto px-1 py-1">
          {loading && !optimisticChat ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-muted" />
            </div>
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
          <div className="shrink-0 px-3 pt-2 pb-2 border-t border-line">
            <button
              onClick={() => setBulkDeletePending(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 transition-colors"
            >
              <Trash2 size={13} />
              Delete {selectedCount} {selectedCount === 1 ? 'conversation' : 'conversations'}
            </button>
          </div>
        )}

        {/* New Chat button */}
        <div className="shrink-0 px-3 py-3 border-t border-line">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-line bg-bg text-ink2 hover:border-ink2 hover:text-ink text-sm font-medium transition-colors"
          >
            <PlusCircle size={14} />
            New chat
          </button>
        </div>
      </aside>

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
