'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { t } from '@/lib/i18n'
import { extractKeywords } from '@/lib/utils/project-keywords'
import { searchNestableJobs, type NestableJob } from '@/lib/supabase/queries/projects'
import type { LangCode } from '@/lib/i18n'

interface Props {
  open:         boolean
  projectName:  string
  client:       string
  lang:         LangCode
  callerRole:   string
  callerId:     string
  nestedIds:    string[]          // already nested (this project) — shown disabled
  onNest:       (job: NestableJob) => void
  onNewJobHere: (() => void) | null   // null = hidden (unsaved new project)
  onClose:      () => void
}

const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

export function AddJobPicker({
  open, projectName, client, lang, callerRole, callerId, nestedIds, onNest, onNewJobHere, onClose,
}: Props) {
  const [query,   setQuery]   = useState('')
  const [rows,    setRows]    = useState<NestableJob[]>([])
  const [loading, setLoading] = useState(false)
  const keywords = extractKeywords(projectName, client)

  useEffect(() => {
    if (!open) return
    let stale = false
    setLoading(true)
    const timer = setTimeout(() => {
      searchNestableJobs({ keywords, query, callerRole, callerId })
        .then(r => { if (!stale) setRows(r) })
        .catch(() => { if (!stale) setRows([]) })
        .finally(() => { if (!stale) setLoading(false) })
    }, 250)
    return () => { stale = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-ink/40" onClick={onClose}>
      <div
        className="w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-paper p-4 pb-6"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={`${t(lang, 'jpPickerTitle')} ${projectName}`}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-base font-medium text-ink">
            {t(lang, 'jpPickerTitle')} {projectName || '…'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-[10px] border border-line bg-bg px-3 py-2 mb-2">
          <Search size={14} className="text-muted shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t(lang, 'jpPickerSearch')}
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta/20"
          />
        </div>

        {keywords.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="text-[10px] uppercase tracking-wide text-muted">{t(lang, 'jpPickerMatching')}</span>
            {keywords.slice(0, 5).map(k => (
              <span key={k} className="rounded-full border border-terracotta bg-terracotta/10 px-2 py-0.5 text-[11px] text-terracotta">{k}</span>
            ))}
          </div>
        )}

        {loading && <p className="py-4 text-center text-sm text-muted">…</p>}
        {!loading && rows.map(job => {
          const already = nestedIds.includes(job.id)
          return (
            <div key={job.id} className="flex items-center justify-between gap-2 border-b border-line py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-ink">{job.project_title || job.client || 'Untitled job'}</p>
                <p className="text-[11px] text-muted">
                  <span className="capitalize">{job.status}</span> · {fmtDate(job.date)} · {job.client}
                </p>
              </div>
              <button
                type="button"
                disabled={already}
                onClick={() => onNest(job)}
                className={already
                  ? 'shrink-0 rounded-full border border-line bg-bg px-3 py-1 text-xs font-medium text-muted'
                  : 'shrink-0 rounded-full border border-terracotta bg-terracotta/10 px-3 py-1 text-xs font-medium text-terracotta'}
              >
                {already ? t(lang, 'jpNested') : t(lang, 'jpNest')}
              </button>
            </div>
          )
        })}

        {onNewJobHere && (
          <button
            type="button"
            onClick={onNewJobHere}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-sm font-medium text-ink2 hover:border-ink2"
          >
            <Plus size={14} />{t(lang, 'jpNewJobHere')}
          </button>
        )}
      </div>
    </div>
  )
}
