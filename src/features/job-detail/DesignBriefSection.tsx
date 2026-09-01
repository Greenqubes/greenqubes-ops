'use client'

import { forwardRef, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { Btn } from '@/components/Btn'
import { CollapseCard } from './CollapseCard'
import { useCardCollapse } from './useCardCollapse'
import { DesignerGrid, type DesignerOption } from './DesignerGrid'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import { Paperclip, Trash2, Lock, PenTool, Sparkles, ChevronDown } from 'lucide-react'
import type { LangCode } from '@/lib/i18n'
import type { JobFile } from '@/lib/supabase/queries/jobs'

const FIELD_BASE = 'w-full rounded-lg border bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150'
const fieldBorder = (error?: boolean) =>
  error ? 'border-terracotta focus:border-terracotta' : 'border-line focus:border-terracotta'

// Interfaces per the Task 6 brief list `jobId/lang/readOnly/briefText/onBriefText/
// dueDate/dueManual/onDueDate/briefError`; `canManage`, `userId` and `files` were
// added — the brief's own text needs an uploader id for the files insert and a
// "manager vs everyone-else" split (brief TEXT + due date are sales/scheduler/
// coordinator/admin-only, but the attachment strip stays open to designers too,
// per the 0048 migration's designer-upload RLS grant), and `files` mirrors how
// ProductionReadySection receives its file list as a prop from the job row
// rather than each card re-querying the table itself.
export interface DesignBriefSectionProps {
  jobId:       string | null
  lang:        LangCode
  readOnly:    boolean
  canManage:   boolean
  userId:      string
  briefText:   string
  onBriefText: (v: string) => void
  dueDate:     string | null
  dueManual:   boolean
  onDueDate:   (v: string | null) => void
  briefError:  boolean
  files:       JobFile[]
  // Edit 14 (smoke feedback, 2026-08-28): the Designers grid relocates here
  // from the Team tab. State stays owned by the shells (JobDetailShell /
  // NewJobShell) — this card only hosts DesignerGrid via props, same as the
  // brief text/due-date fields above pass through onBriefText/onDueDate.
  // Gating reuses `readOnly`/`canManage` (textLocked below) — identical to
  // the `(readOnly || !canEditCore)` / `canEditDesigners` checks the Team
  // tab used to apply to this same grid.
  designerOptions:     DesignerOption[]
  selectedDesignerIds: string[]
  onToggleDesigner:    (id: string) => void
}

export const DesignBriefSection = forwardRef<HTMLDivElement, DesignBriefSectionProps>(
  function DesignBriefSection(
    {
      jobId, lang, readOnly, canManage, userId, briefText, onBriefText, dueDate, dueManual, onDueDate, briefError, files,
      designerOptions, selectedDesignerIds, onToggleDesigner,
    },
    ref,
  ) {
    const router = useRouter()
    const { success: showSuccess, error: showError } = useToast()
    const supabase = createClient()
    const fileRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)

    const textLocked = readOnly || !canManage
    const dueLocked  = readOnly || !canManage
    // Designers subsection collapse — per-device memory via the same
    // useCardCollapse hook the outer CollapseCard uses (trivially reusable,
    // just a new storageKey), default open.
    const { open: designersOpen, toggle: toggleDesigners } = useCardCollapse('gq-jobcard-designbrief-designers')

    const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? [])
      if (!selected.length || !jobId) return
      e.target.value = ''
      setUploading(true)
      try {
        for (const file of selected) {
          const contentType = file.type || 'application/octet-stream'
          const urlRes = await fetch('/api/r2/upload-url', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ jobId, kind: 'design_brief', filename: file.name, contentType }),
          })
          if (!urlRes.ok) throw new Error()
          const { url, key } = await urlRes.json() as { url: string; key: string }

          const putRes = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } })
          if (!putRes.ok) throw new Error()

          await supabase.from('files').insert({
            job_id:      jobId,
            bucket_id:   null,
            kind:        'design_brief',
            r2_key:      key,
            name:        file.name,
            uploader_id: userId,
            visibility:  ['public-internal'],
          } as never).throwOnError()
        }
        router.refresh()
        showSuccess(t(lang, 'savedSuccessfully'))
        // Fire-and-forget rescore — this insert is client-side (no server
        // route sees it), so the AI scoring engine (Task 7) never learns
        // about the new attachment unless we tell it here.
        void fetch(`/api/jobs/${jobId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ rescore: true }),
        })
      } catch {
        showError(t(lang, 'saveError'))
      } finally {
        setUploading(false)
      }
    }

    const handleDelete = async (fileId: string) => {
      try {
        const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: '' })) as { error?: string }
          showError(`Could not delete the file${error ? ` — ${error}` : ''}.`)
          return
        }
      } catch {
        showError('Could not delete the file — no connection.')
        return
      }
      router.refresh()
      showSuccess('File deleted.')
    }

    const getDownloadUrl = async (key: string, filename?: string): Promise<string> => {
      const res = await fetch('/api/r2/download-url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key, filename }),
      })
      const { url } = await res.json() as { url: string }
      return url
    }

    return (
      <div ref={ref}>
        <CollapseCard title={t(lang, 'designBriefTitle')} storageKey="gq-jobcard-designbrief">
          <div className="space-y-4">

            {/* 1. Brief text */}
            <div>
              <textarea
                value={briefText}
                onChange={e => onBriefText(e.target.value)}
                disabled={textLocked}
                placeholder={t(lang, 'designBriefPlaceholder')}
                rows={3}
                className={cn(FIELD_BASE, 'resize-none', fieldBorder(briefError))}
              />
              {briefError && (
                <p className="text-xs text-terracotta mt-1">{t(lang, 'designBriefRequired')}</p>
              )}
            </div>

            {/* 2. Attachments */}
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-2">
                {t(lang, 'attachments')}
              </p>
              {jobId === null ? (
                <div className="rounded-lg border border-line bg-bg opacity-60 pointer-events-none select-none px-3 py-4 flex items-center justify-center gap-2 text-muted text-sm">
                  <Lock size={14} />
                  Save the job first to add attachments.
                </div>
              ) : (
                <>
                  {files.length > 0 && (
                    <ul className="divide-y divide-line mb-2">
                      {files.map(file => (
                        <DesignBriefFileRow
                          key={file.id}
                          file={file}
                          readOnly={readOnly}
                          onDelete={() => handleDelete(file.id)}
                          getDownloadUrl={getDownloadUrl}
                        />
                      ))}
                    </ul>
                  )}
                  {!readOnly && (
                    <>
                      <input ref={fileRef} type="file" multiple className="hidden"
                        onChange={handleFiles} />
                      <Btn variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        <Paperclip size={13} />
                        {uploading ? t(lang, 'uploading') : t(lang, 'attachFiles')}
                      </Btn>
                    </>
                  )}
                  {readOnly && files.length === 0 && (
                    <p className="text-sm text-muted italic">None</p>
                  )}
                </>
              )}
            </div>

            {/* 3. Due date */}
            <div>
              <label className="text-sm font-medium text-ink2 mb-1.5 block">
                {t(lang, 'designDueDateLabel')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dueDate ?? ''}
                  onChange={e => onDueDate(e.target.value || null)}
                  disabled={dueLocked}
                  className={cn(FIELD_BASE, fieldBorder(false))}
                />
                {!dueManual && dueDate && (
                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-terracotta/10 text-terracotta text-[10px] font-semibold uppercase tracking-wide">
                    <Sparkles size={10} />
                    {t(lang, 'designDueAiSuggested')}
                  </span>
                )}
              </div>
            </div>

            {/* 3.5 Designers — collapsible subsection, relocated from the Team
                tab (edit 14, smoke feedback 2026-08-28). Same DesignerGrid
                component, same selectedDesignerIds state (owned by the
                shell); onToggle reuses textLocked, identical to the Team
                tab's old `(readOnly || !canEditCore)` / `canEditDesigners`
                gate. Collapse is PC-only, mirroring CollapseCard.tsx /
                TaskListSection.tsx exactly: the toggle button is
                `hidden lg:flex` (no toggle affordance on mobile) and the
                body always renders, folding only via `lg:hidden` — so phone
                users always see the grid regardless of the stored
                preference; only lg+ can collapse it. */}
            <div className="border-t border-line pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                  {t(lang, 'designersLabel')}
                </span>
                <button
                  type="button"
                  onClick={toggleDesigners}
                  aria-expanded={designersOpen}
                  className="hidden lg:flex items-center justify-center w-6 h-6 rounded text-muted hover:text-ink transition-colors"
                >
                  <ChevronDown size={14} className={cn('transition-transform', !designersOpen && '-rotate-90')} />
                </button>
              </div>
              <div className={cn(!designersOpen && 'lg:hidden')}>
                {designerOptions.length === 0 ? (
                  <p className="text-sm text-muted">{t(lang, 'noDesigners')}</p>
                ) : (
                  <DesignerGrid
                    designers={designerOptions}
                    selectedIds={selectedDesignerIds}
                    onToggle={textLocked ? undefined : onToggleDesigner}
                  />
                )}
              </div>
            </div>

            {/* 4. Whiteboard placeholder */}
            <button
              type="button"
              disabled
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-line text-sm font-medium text-muted opacity-60 cursor-not-allowed"
            >
              <PenTool size={14} />
              {t(lang, 'whiteboardSoon')}
            </button>

          </div>
        </CollapseCard>
      </div>
    )
  },
)

function DesignBriefFileRow({ file, readOnly, onDelete, getDownloadUrl }: {
  file:           JobFile
  readOnly:       boolean
  onDelete:       () => void
  getDownloadUrl: (key: string, filename?: string) => Promise<string>
}) {
  const [loading, setLoading] = useState(false)
  const filename = file.name ?? (file.r2_key.split('/').pop() ?? file.r2_key)

  const handleOpen = async () => {
    setLoading(true)
    try {
      const url = await getDownloadUrl(file.r2_key, file.name ?? undefined)
      window.open(url, '_blank', 'noopener')
    } finally {
      setLoading(false)
    }
  }

  return (
    <li className="flex items-center gap-2 py-2 group">
      <Paperclip size={13} className="text-muted shrink-0" />
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className="flex-1 min-w-0 text-left text-sm text-ink truncate hover:underline"
      >
        {filename}
      </button>
      {!readOnly && (
        <button
          type="button"
          onClick={onDelete}
          className="text-muted opacity-0 group-hover:opacity-100 hover:text-terracotta transition-all shrink-0"
        >
          <Trash2 size={13} />
        </button>
      )}
    </li>
  )
}
