// src/features/assistant/HistorySidebar.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { PlusCircle, Loader2 } from 'lucide-react'
import { HistoryList } from './HistoryList'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'

interface Props {
  activeChatId?: string
  onLoad:        (chat: AsstChatRow) => void
  onNewChat:     () => void
  onDelete:      (id: string) => void
}

export function HistorySidebar({ activeChatId, onLoad, onNewChat, onDelete }: Props) {
  const [chats,   setChats]   = useState<AsstChatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState<string | null>(null)

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant/history')
      if (res.ok) setChats(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchChats() }, [fetchChats])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
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

  async function handleDelete(id: string) {
    // Optimistic update
    setChats(prev => prev.filter(c => c.id !== id))
    onDelete(id)

    const res = await fetch('/api/assistant/delete', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })

    if (!res.ok) {
      // Refetch to restore state
      fetchChats()
    }
  }

  return (
    <aside className="hidden md:flex flex-col shrink-0 w-[260px] border-r border-line bg-paper h-screen sticky top-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">History</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-muted" />
          </div>
        ) : chats.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted text-center">No conversations yet</p>
        ) : (
          <HistoryList
            chats={chats}
            activeChatId={activeChatId}
            onLoad={onLoad}
            onPin={handlePin}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-16 left-2 right-2 px-3 py-2 bg-ink text-white text-xs rounded-lg shadow-md text-center">
          {toast}
        </div>
      )}

      {/* New Chat button */}
      <div className="shrink-0 p-3 border-t border-line">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-line bg-bg text-ink2 hover:border-ink2 hover:text-ink text-sm font-medium transition-colors"
        >
          <PlusCircle size={14} />
          New chat
        </button>
      </div>
    </aside>
  )
}
