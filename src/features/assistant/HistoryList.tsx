// src/features/assistant/HistoryList.tsx
'use client'

import { useState, useEffect } from 'react'
import { Pin, MoreVertical, Check, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'

interface Props {
  chats:           AsstChatRow[]
  activeChatId?:   string
  onLoad:          (chat: AsstChatRow) => void
  onPin:           (id: string, pinned: boolean) => void
  onDelete:        (id: string) => void
  onRename:        (id: string, currentTopic: string) => void
  mobile?:         boolean
  isSelecting?:    boolean
  selectedIds?:    Set<string>
  onToggleSelect?: (id: string) => void
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

const GROUP_LABELS: Record<Group, string> = {
  pinned:  'Pinned',
  today:   'Today',
  week:    'This Week',
  earlier: 'Earlier',
}

const GROUP_ORDER: Group[] = ['pinned', 'today', 'week', 'earlier']

export function HistoryList({ chats, activeChatId, onLoad, onPin, onDelete, onRename, mobile, isSelecting, selectedIds, onToggleSelect }: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  useEffect(() => {
    if (!openMenuId) return
    function handleOutside() { setOpenMenuId(null) }
    document.addEventListener('click', handleOutside)
    return () => document.removeEventListener('click', handleOutside)
  }, [openMenuId])

  useEffect(() => {
    if (isSelecting) setOpenMenuId(null)
  }, [isSelecting])

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

  function handleRenameClick(id: string, topic: string) {
    setOpenMenuId(null)
    onRename(id, topic)
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
                isSelecting={isSelecting}
                isSelected={selectedIds?.has(chat.id) ?? false}
                onLoad={() => onLoad(chat)}
                onToggleMenu={() => setOpenMenuId(openMenuId === chat.id ? null : chat.id)}
                onPin={() => handlePin(chat)}
                onDeleteClick={() => handleDeleteClick(chat.id)}
                onRenameClick={() => handleRenameClick(chat.id, chat.topic ?? '')}
                onToggleSelect={() => onToggleSelect?.(chat.id)}
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
  chat:            AsstChatRow
  isActive:        boolean
  isMenuOpen:      boolean
  mobile?:         boolean
  isSelecting?:    boolean
  isSelected?:     boolean
  onLoad:          () => void
  onToggleMenu:    () => void
  onPin:           () => void
  onDeleteClick:   () => void
  onRenameClick:   () => void
  onToggleSelect:  () => void
}

function ChatRow({
  chat, isActive, isMenuOpen, mobile,
  isSelecting, isSelected,
  onLoad, onToggleMenu, onPin, onDeleteClick, onRenameClick, onToggleSelect,
}: RowProps) {
  const topic = chat.topic ?? 'Untitled conversation'

  return (
    <div className="relative group">
      <button
        onClick={isSelecting ? onToggleSelect : onLoad}
        className={cn(
          'w-full text-left px-3 py-2 rounded-lg transition-colors flex items-start gap-2.5',
          isSelecting
            ? isSelected
              ? 'bg-terracotta/10 border border-terracotta/20'
              : 'hover:bg-bg border border-transparent'
            : isActive
              ? 'bg-terracotta/10 border border-terracotta/20'
              : 'hover:bg-bg',
        )}
      >
        {/* Checkbox in select mode */}
        {isSelecting && (
          <span className={cn(
            'shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors',
            isSelected ? 'bg-terracotta border-terracotta' : 'border-muted bg-paper',
          )}>
            {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
          </span>
        )}

        <div className={cn('flex flex-col gap-0.5 min-w-0 flex-1', !isSelecting && (!mobile ? 'pr-10' : 'pr-8'))}>
          <span className="text-sm font-medium text-ink line-clamp-2 leading-tight">
            {chat.pinned && !isSelecting && <span className="mr-1 text-amber text-[11px]">📌</span>}
            {topic}
          </span>
        </div>
      </button>

      {/* Desktop hover actions */}
      {!isSelecting && !mobile && (
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

      {/* Mobile ⋮ */}
      {!isSelecting && mobile && (
        <button
          onClick={e => { e.stopPropagation(); onToggleMenu() }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted hover:text-ink hover:bg-line transition-colors"
        >
          <MoreVertical size={14} />
        </button>
      )}

      {/* ⋮ dropdown */}
      {!isSelecting && isMenuOpen && (
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
            onClick={e => { e.stopPropagation(); onRenameClick() }}
            className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-bg transition-colors flex items-center gap-2"
          >
            <Pencil size={13} className="text-muted" />
            Rename
          </button>
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
