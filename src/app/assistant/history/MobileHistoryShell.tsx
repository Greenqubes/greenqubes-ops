'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { HistoryList } from '@/features/assistant/HistoryList'
import { Modal } from '@/components/Modal'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'
import type { LangCode } from '@/lib/supabase/types'

interface Props { lang: LangCode }

export function MobileHistoryShell({ lang: _lang }: Props) {
  const router = useRouter()
  const [chats,           setChats]           = useState<AsstChatRow[]>([])
  const [loading,         setLoading]         = useState(true)
  const [toast,           setToast]           = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant/history')
      if (res.ok) setChats(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchChats() }, [fetchChats])

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
    setChats(prev => prev.map(c => c.id === id ? { ...c, pinned } : c))
    const res = await fetch('/api/assistant/pin', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, pinned }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setChats(prev => prev.map(c => c.id === id ? { ...c, pinned: !pinned } : c))
      if (body?.reason === 'pin_cap') showToast('You can pin up to 5 conversations')
    }
  }

  async function confirmDelete() {
    const id = pendingDeleteId
    if (!id) return
    setPendingDeleteId(null)

    setChats(prev => prev.filter(c => c.id !== id))
    const res = await fetch('/api/assistant/delete', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })
    if (!res.ok) fetchChats()
  }

  function handleLoad(chat: AsstChatRow) {
    router.push(`/assistant?chat=${chat.id}`)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-line bg-paper px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-display text-[15px] font-medium text-ink">History</h1>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-muted" />
          </div>
        ) : chats.length === 0 ? (
          <p className="text-center text-sm text-muted py-12">No conversations yet</p>
        ) : (
          <HistoryList
            chats={chats}
            onLoad={handleLoad}
            onPin={handlePin}
            onDelete={setPendingDeleteId}
            mobile
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 px-4 py-2.5 bg-ink text-white text-sm rounded-xl shadow-md text-center">
          {toast}
        </div>
      )}

      {/* Delete confirmation modal */}
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
    </div>
  )
}
