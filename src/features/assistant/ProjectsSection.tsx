// src/features/assistant/ProjectsSection.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Plus, Folder, FolderOpen, ChevronRight, MoreVertical,
  Settings2, MessageSquarePlus, Trash2,
} from 'lucide-react'
import { ChatRow } from './HistoryList'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'
import type { ProjectWithFiles } from '@/lib/supabase/queries/assistant-projects'

interface Props {
  projects:           ProjectWithFiles[]
  chats:              AsstChatRow[]
  activeChatId?:      string
  lang:               LangCode
  onLoad:             (chat: AsstChatRow) => void
  onOpenPanel:        (id: string) => void
  onNewChatInProject: (id: string) => void
  onChanged:          () => void
  onPin:              (id: string, pinned: boolean) => void
  onDelete:           (id: string) => void
  onRename:           (id: string, topic: string) => void
  onMove:             (id: string) => void
  mobile?:            boolean
}

export function ProjectsSection({
  projects, chats, activeChatId, lang,
  onLoad, onOpenPanel, onNewChatInProject, onChanged,
  onPin, onDelete, onRename, onMove, mobile,
}: Props) {
  const [expanded,        setExpanded]        = useState<Set<string>>(new Set())
  const [openMenuId,      setOpenMenuId]      = useState<string | null>(null)
  const [openChatMenuId,  setOpenChatMenuId]  = useState<string | null>(null)
  const [createOpen,      setCreateOpen]      = useState(false)
  const [nameInput,       setNameInput]       = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [busy,            setBusy]            = useState(false)

  useEffect(() => {
    if (!openMenuId) return
    function handleOutside() { setOpenMenuId(null) }
    document.addEventListener('click', handleOutside)
    return () => document.removeEventListener('click', handleOutside)
  }, [openMenuId])

  useEffect(() => {
    if (!openChatMenuId) return
    function handleOutside() { setOpenChatMenuId(null) }
    document.addEventListener('click', handleOutside)
    return () => document.removeEventListener('click', handleOutside)
  }, [openChatMenuId])

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirmCreate() {
    const name = nameInput.trim()
    if (!name || busy) return
    setBusy(true)
    const res = await fetch('/api/assistant/projects', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name }),
    })
    setBusy(false)
    if (res.ok) {
      setCreateOpen(false)
      setNameInput('')
      onChanged()
    }
  }

  async function confirmDelete() {
    const id = pendingDeleteId
    if (!id || busy) return
    setBusy(true)
    const res = await fetch('/api/assistant/projects', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })
    setBusy(false)
    setPendingDeleteId(null)
    if (res.ok) onChanged()
  }

  return (
    <div className="mb-1">
      {/* Header */}
      <div className="px-4 pt-2 pb-1 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{t(lang, 'projects')}</p>
        <button
          onClick={() => { setNameInput(''); setCreateOpen(true) }}
          title={t(lang, 'newProject')}
          aria-label={t(lang, 'newProject')}
          className="p-1 rounded-md text-muted hover:text-ink hover:bg-line transition-colors"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Folders */}
      {projects.map(p => {
        const projectChats = chats.filter(c => c.project_id === p.id)
        const isOpen       = expanded.has(p.id)
        return (
          <div key={p.id} className="px-1">
            <div className="relative group">
              <button
                onClick={() => toggleExpand(p.id)}
                className="w-full text-left px-2 py-2 rounded-lg hover:bg-bg transition-colors flex items-center gap-2"
              >
                <ChevronRight size={12} className={cn('shrink-0 text-muted transition-transform', isOpen && 'rotate-90')} />
                {isOpen
                  ? <FolderOpen size={14} className="shrink-0 text-terracotta" />
                  : <Folder size={14} className="shrink-0 text-muted" />}
                <span className="text-sm font-medium text-ink truncate flex-1 pr-6">{p.name}</span>
                <span className="text-[10px] text-muted shrink-0">{projectChats.length}</span>
              </button>
              <button
                onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === p.id ? null : p.id) }}
                className={cn(
                  'absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-ink hover:bg-line transition-colors',
                  !mobile && 'opacity-0 group-hover:opacity-100',
                )}
              >
                <MoreVertical size={13} />
              </button>

              {openMenuId === p.id && (
                <div className="absolute right-2 top-full mt-1 z-20 min-w-[190px] bg-paper border border-line rounded-xl shadow-md py-1">
                  <button
                    onClick={e => { e.stopPropagation(); setOpenMenuId(null); onNewChatInProject(p.id) }}
                    className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-bg transition-colors flex items-center gap-2"
                  >
                    <MessageSquarePlus size={13} className="text-muted" />
                    {t(lang, 'newChatInProject')}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setOpenMenuId(null); onOpenPanel(p.id) }}
                    className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-bg transition-colors flex items-center gap-2"
                  >
                    <Settings2 size={13} className="text-muted" />
                    {t(lang, 'projectSettings')}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setOpenMenuId(null); setPendingDeleteId(p.id) }}
                    className="w-full text-left px-3 py-2 text-sm text-terracotta hover:bg-bg transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={13} />
                    {t(lang, 'projectDelete')}
                  </button>
                </div>
              )}
            </div>

            {/* Nested chats */}
            {isOpen && projectChats.length > 0 && (
              <div className="ml-5 border-l border-line pl-1">
                {projectChats.map(chat => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    isActive={chat.id === activeChatId}
                    isMenuOpen={openChatMenuId === chat.id}
                    mobile={mobile}
                    onLoad={() => onLoad(chat)}
                    onToggleMenu={() => setOpenChatMenuId(openChatMenuId === chat.id ? null : chat.id)}
                    onPin={() => { setOpenChatMenuId(null); onPin(chat.id, !chat.pinned) }}
                    onDeleteClick={() => { setOpenChatMenuId(null); onDelete(chat.id) }}
                    onRenameClick={() => { setOpenChatMenuId(null); onRename(chat.id, chat.topic ?? '') }}
                    onMoveClick={() => { setOpenChatMenuId(null); onMove(chat.id) }}
                    onToggleSelect={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)}>
        <p className="font-display text-base font-medium text-ink mb-3">{t(lang, 'newProject')}</p>
        <input
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmCreate() }}
          placeholder={t(lang, 'projectName')}
          maxLength={60}
          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60 mb-4"
          autoFocus
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setCreateOpen(false)}
            className="px-4 py-2 rounded-xl border border-line text-ink2 text-sm font-medium hover:border-ink2 transition-colors"
          >
            {t(lang, 'memoryCancel')}
          </button>
          <button
            onClick={confirmCreate}
            disabled={!nameInput.trim() || busy}
            className="px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t(lang, 'memorySave')}
          </button>
        </div>
      </Modal>

      {/* Delete confirm — chats are kept (spec: stated in the modal) */}
      <Modal isOpen={pendingDeleteId !== null} onClose={() => setPendingDeleteId(null)}>
        <p className="font-display text-base font-medium text-ink mb-1">{t(lang, 'projectDelete')}</p>
        <p className="text-sm text-ink2 mb-5">{t(lang, 'projectDeleteConfirm')}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setPendingDeleteId(null)}
            className="px-4 py-2 rounded-xl border border-line text-ink2 text-sm font-medium hover:border-ink2 transition-colors"
          >
            {t(lang, 'memoryCancel')}
          </button>
          <button
            onClick={confirmDelete}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 transition-colors"
          >
            {t(lang, 'projectDelete')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
