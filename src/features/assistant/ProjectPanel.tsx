// src/features/assistant/ProjectPanel.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Paperclip, Trash2, Plus, Folder } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { validateAttachment } from '@/lib/ai/attachments'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { ProjectWithFiles } from '@/lib/supabase/queries/assistant-projects'

interface Props {
  project:   ProjectWithFiles | null
  onClose:   () => void
  onChanged: () => void
  lang:      LangCode
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function ProjectPanel({ project, onClose, onChanged, lang }: Props) {
  const [name,         setName]         = useState('')
  const [instructions, setInstructions] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [confirmId,    setConfirmId]    = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { error: showError } = useToast()

  // Re-seed the form whenever a different project opens
  const projectId = project?.id
  useEffect(() => {
    if (project) {
      setName(project.name)
      setInstructions(project.instructions ?? '')
      setConfirmId(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  if (!project) return null

  const dirty = name.trim() !== project.name ||
    (instructions.trim() || null) !== (project.instructions?.trim() || null)

  async function saveSettings() {
    if (!project || !name.trim() || saving) return
    setSaving(true)
    const res = await fetch('/api/assistant/projects', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: project.id, name: name.trim(), instructions: instructions.trim() || null }),
    })
    setSaving(false)
    if (res.ok) onChanged()
  }

  async function handleFilePicked(list: FileList | null) {
    if (!project || !list?.length || uploading) return
    const f = list[0]
    const perFile = validateAttachment(f.name, f.type, f.size)
    if (perFile === 'type') { showError(t(lang, 'attachUnsupported')); return }
    if (perFile === 'size') { showError(t(lang, 'attachTooLarge')); return }
    setUploading(true)
    try {
      const urlRes = await fetch('/api/assistant/projects/upload-url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ projectId: project.id, filename: f.name, contentType: f.type, size: f.size }),
      })
      if (!urlRes.ok) {
        const { error } = await urlRes.json().catch(() => ({ error: '' })) as { error?: string }
        if (error === 'count')      showError(t(lang, 'projectFileTooMany'))
        else if (error === 'total') showError(t(lang, 'projectFileTotalTooLarge'))
        else if (error === 'type')  showError(t(lang, 'attachUnsupported'))
        else if (error === 'size')  showError(t(lang, 'attachTooLarge'))
        else                        showError(t(lang, 'attachUploadFailed'))
        return
      }
      const { url, key } = await urlRes.json() as { url: string; key: string }
      const put = await fetch(url, { method: 'PUT', body: f, headers: { 'Content-Type': f.type } })
      if (!put.ok) throw new Error()
      const reg = await fetch('/api/assistant/projects/files', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ projectId: project.id, key, name: f.name, mime: f.type, size: f.size }),
      })
      if (!reg.ok) throw new Error()
      onChanged()
    } catch {
      showError(t(lang, 'attachUploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function removeFile(id: string) {
    setConfirmId(null)
    const res = await fetch('/api/assistant/projects/files', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })
    if (res.ok) onChanged()
    else showError(t(lang, 'attachUploadFailed'))
  }

  return (
    // z-[70]: above the phone drawer (z-[60]) — MemoryView pattern
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto bg-paper rounded-card border border-line shadow-xl p-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <Folder size={16} className="text-terracotta shrink-0" />
          <p className="font-display text-base font-medium text-ink flex-1 truncate">{t(lang, 'projectSettings')}</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Name */}
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">
          {t(lang, 'projectName')}
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={60}
          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60 mb-4"
        />

        {/* Instructions */}
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">
          {t(lang, 'projectInstructions')}
        </label>
        <p className="text-xs text-muted mb-1.5">{t(lang, 'projectInstructionsHint')}</p>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60 mb-2"
        />
        <div className="flex justify-end mb-5">
          <button
            onClick={saveSettings}
            disabled={!dirty || !name.trim() || saving}
            className="px-4 py-2 rounded-xl bg-terracotta text-white text-sm font-medium hover:bg-terracotta/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t(lang, 'memorySave')}
          </button>
        </div>

        {/* Files */}
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">
          {t(lang, 'projectFiles')}
        </label>
        <p className="text-xs text-muted mb-2">{t(lang, 'projectFilesHint')}</p>
        <div className="space-y-1.5 mb-3">
          {project.files.map(f => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-bg">
              <Paperclip size={12} className="shrink-0 text-muted" />
              <span className="text-sm text-ink truncate flex-1">{f.name}</span>
              <span className="text-[11px] text-muted shrink-0">{fmtSize(f.size)}</span>
              {confirmId === f.id ? (
                <button
                  onClick={() => removeFile(f.id)}
                  className="text-[11px] font-medium text-terracotta shrink-0 px-1.5"
                >
                  {t(lang, 'memoryForget')}
                </button>
              ) : (
                <button
                  onClick={() => setConfirmId(f.id)}
                  className="p-1 rounded-md text-muted hover:text-terracotta hover:bg-line transition-colors shrink-0"
                  aria-label={t(lang, 'memoryForget')}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={e => { handleFilePicked(e.target.files); e.target.value = '' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-line text-ink2 text-sm font-medium hover:border-ink2 disabled:opacity-50 transition-colors"
        >
          <Plus size={13} className={uploading ? 'animate-pulse' : undefined} />
          {t(lang, 'projectAddFile')}
        </button>
      </div>
    </div>
  )
}
