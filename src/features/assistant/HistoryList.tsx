// src/features/assistant/HistoryList.tsx
'use client'

import { useState, useEffect } from 'react'
import { Pin, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'
import type { Json } from '@/lib/supabase/types'

interface Props {
  chats:         AsstChatRow[]
  activeChatId?: string
  onLoad:        (chat: AsstChatRow) => void
  onPin:         (id: string, pinned: boolean) => void
  onDelete:      (id: string) => void
  mobile?:       boolean
}

type Group = 'pinned' | 'today' | 'week' | 'earlier'

function getGroup(chat: AsstChatRow): Group {
  if (chat.pinned) return 'pinned'
  const now  = new Date()
  const date = new Date(chat.ts)
  const diffMs   = now.getTime() - date.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  const sameDay  = now.toDateString() === date.toDateString()
  if (sameDay)      return 'today'
  if (diffDays < 7) return 'week'
  return 'earlier'
}

function msgCount(msgs: Json): number {
  if (!Array.isArray(msgs)) return 0
  return msgs.length
}

function stars(importance: number | null): string {
  const n = Math.min(5, Math.max(0, importance ?? 0))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

const GROUP_LABELS: Record<Group, string> = {
  pinned:  'Pinned',
  today:   'Today',
  week:    'This Week',
  earlier: 'Earlier',
}

const GROUP_ORDER: Group[] = ['pinned', 'today', 'week', 'earlier']

export function HistoryList({ chats, activeChatId, onLoad, onPin, onDelete, mobile }: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // Close open menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return
    function handleOutside() { setOpenMenuId(null) }
    document.addEventListener('click', handleOutside)
    return () => document.removeEventListener('click', handleOutside)
  }, [openMenuId])

  const grouped = GROUP_ORDER.reduce<Record<Group, AsstChatRow[]>>(
    (acc, g) => ({ ...acc, [g]: [] }),
    { pinned: [], today: [], week: [], earlier: [] },
  )
  for (const chat of chats) grouped[getGroup(chat)].push(chat)

  function handlePin(chat: AsstChatRow) {
    setOpenMenuId(null)
    onPin(chat.id, !chat.pinned)
  }

  function handleDeleteClick(id: string) {
    setOpenMenuId(null)
    onDelete(id)
  }

  return (
    <div className="flex flex-col gap-1">
      {GROUP_ORDER.map(group => {
        const items = grouped[group]
        if (items.length === 0) return null
        return (
          <div key={group} className="mb-2">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
              {GROUP_LABELS[group]}
            </p>
            {items.map(chat => (
              <ChatRow
                key={chat.id}
                chat={chat}
                isActive={chat.id === activeChatId}
                isMenuOpen={openMenuId === chat.id}
                mobile={mobile}
                onLoad={() => onLoad(chat)}
                onToggleMenu={() => setOpenMenuId(openMenuId === chat.id ? null : chat.id)}
                onPin={() => handlePin(chat)}
                onDeleteClick={() => handleDeleteClick(chat.id)}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── ChatRow ──────────────────────────────────────────────────────────────────

interface RowProps {
  chat:          AsstChatRow
  isActive:      boolean
  isMenuOpen:    boolean
  mobile?:       boolean
  onLoad:        () => void
  onToggleMenu:  () => void
  onPin:         () => void
  onDeleteClick: () => void
}

function ChatRow({
  chat, isActive, isMenuOpen, mobile,
  onLoad, onToggleMenu, onPin, onDeleteClick,
}: RowProps) {
  const topic = chat.topic ?? 'Untitled conversation'
  const count = msgCount(chat.msgs)

  return (
    <div className="relative group">
      <button
        onClick={onLoad}
        className={cn(
          'w-full text-left px-3 py-2 rounded-lg transition-colors flex flex-col gap-0.5',
          isActive ? 'bg-terracotta/10 border border-terracotta/20' : 'hover:bg-bg',
        )}
      >
        <div className={cn('flex items-start justify-between gap-1', !mobile ? 'pr-10' : 'pr-8')}>
          <span className="text-sm font-medium text-ink truncate leading-tight">
            {chat.pinned && <span className="mr-1 text-amber text-[11px]">📌</span>}
            {topic}
          </span>
        </div>
        <span className="text-[11px] text-muted">
          {count} {count === 1 ? 'message' : 'messages'}
          {chat.importance ? <span className="ml-1.5 text-amber">{stars(chat.importance)}</span> : null}
        </span>
      </button>

      {/* Desktop hover actions — hidden on mobile */}
      {!mobile && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onPin() }}
            title={chat.pinned ? 'Unpin' : 'Pin'}
            className={cn(
              'p-1 rounded-md hover:bg-line transition-colors',
              chat.pinned ? 'text-amber' : 'text-muted hover:text-ink',
            )}
          >
            <Pin size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onToggleMenu() }}
            className="p-1 rounded-md text-muted hover:text-ink hover:bg-line transition-colors"
          >
            <MoreVertical size={13} />
          </button>
        </div>
      )}

      {/* Mobile ⋮ — always visible */}
      {mobile && (
        <button
          onClick={e => { e.stopPropagation(); onToggleMenu() }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted hover:text-ink hover:bg-line transition-colors"
        >
          <MoreVertical size={14} />
        </button>
      )}

      {/* ⋮ dropdown */}
      {isMenuOpen && (
        <div className="absolute right-2 top-full mt-1 z-20 min-w-[160px] bg-paper border border-line rounded-xl shadow-md py-1">
          {mobile && (
            <button
              onClick={e => { e.stopPropagation(); onPin() }}
              className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-bg transition-colors flex items-center gap-2"
            >
              <Pin size={13} className={chat.pinned ? 'text-amber' : 'text-muted'} />
              {chat.pinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDeleteClick() }}
            className="w-full text-left px-3 py-2 text-sm text-terracotta hover:bg-bg transition-colors"
          >
            Delete conversation
          </button>
        </div>
      )}
    </div>
  )
}
