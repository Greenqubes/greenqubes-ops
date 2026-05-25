// src/features/assistant/HistorySidebar.tsx
'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { PlusCircle, Loader2 } from 'lucide-react'
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
  const [chats,          setChats]          = useState<AsstChatRow[]>([])
  const [loading,        setLoading]        = useState(true)
  const [toast,          setToast]          = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

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

  // Clear toast timer on unmount
  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }
  }, [])

  function showToast(msg: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  async function handlePin(id: string, pinned: boolean) {
    // Optimistic update
    setChats(prev => prev.map(c => c.id === id ? { ...c, pinned } : c))

    const res = await fetch('/api/assistant/pin', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, pinned }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      // Revert
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

    // Optimistic update
    setChats(prev => prev.filter(c => c.id !== id))
    onDelete(id)

    const res = await fetch('/api/assistant/delete', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })

    if (!res.ok) {
      fetchChats()
    }
  }

  return (
    <>
      <aside className="hidden md:flex flex-col shrink-0 w-[260px] border-r border-line bg-paper h-screen sticky top-0 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">History</p>
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
            />
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-[120px] left-2 right-2 px-3 py-2 bg-ink text-paper text-xs rounded-lg shadow-md text-center">
            {toast}
          </div>
        )}

        {/* New Chat button — pb-[72px] clears the fixed BottomNav (~60px) */}
        <div className="shrink-0 px-3 pt-3 pb-[72px] border-t border-line">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-line bg-bg text-ink2 hover:border-ink2 hover:text-ink text-sm font-medium transition-colors"
          >
            <PlusCircle size={14} />
            New chat
          </button>
        </div>
      </aside>

      {/* Modal rendered outside aside to escape overflow:hidden */}
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
    </>
  )
}
