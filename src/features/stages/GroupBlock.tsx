'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import { Folder, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t as tr, type LangCode } from '@/lib/i18n'
import { groupSummary, titleInGroup, type JobGroup } from '@/lib/utils/job-groups'
import type { StageJob } from '@/lib/supabase/queries/jobs'

export type GroupBlockProps = {
  group:        JobGroup
  /** This section's jobs in the group (visible ones only). */
  jobs:         StageJob[]
  open:         boolean
  onToggleOpen: () => void
  /** The group's tick box; null = this list has no tick boxes. */
  tick:         'all' | 'some' | 'none' | null
  onTickAll:    () => void
  canChange:    boolean
  onRename:     () => void
  onUngroup:    () => void
  renderJob:    (job: StageJob, shortTitle: string) => ReactNode
  /** Drag on a computer: this group as a drop target. */
  drop?:        { active: boolean; hint: string; props: HTMLAttributes<HTMLLIElement> }
  lang:         LangCode
}

const titleOf = (j: StageJob) => j.project_title || j.client || 'Untitled job'

/**
 * One Jobs tab group (Nic, 2026-11-11; approved mockup): folded, a single row
 * with the name, the company and sales person when every job shares them, and
 * a count; tap to open. Open, it lists its jobs with only the rest of each
 * title, plus Rename and Ungroup for the people who may change groups.
 */
export function GroupBlock({ group, jobs, open, onToggleOpen, tick, onTickAll, canChange, onRename, onUngroup, renderJob, drop, lang }: GroupBlockProps) {
  const sum = groupSummary(jobs)
  const line = [sum.client, sum.salesName && `${tr(lang, 'arrangeSales')}: ${sum.salesName}`].filter(Boolean).join(' · ')
  return (
    <li data-group-card={group.id} {...drop?.props}
      className={cn('scroll-mt-20 rounded-[14px] border border-line bg-paper overflow-hidden',
        drop?.active && 'border-2 border-dashed border-brand-green bg-brand-green-soft')}>
      <div className="flex items-center gap-3 px-4 py-3">
        {tick !== null && (
          <input type="checkbox" checked={tick === 'all'} aria-label="Select group"
            ref={el => { if (el) el.indeterminate = tick === 'some' }}
            onChange={onTickAll} />
        )}
        <button type="button" onClick={onToggleOpen} aria-expanded={open}
          className="flex flex-1 min-w-0 items-center gap-3 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-green-soft text-brand-green">
            <Folder size={16} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-sm font-semibold text-ink truncate">{group.name}</span>
            {line && <span className="block text-xs text-muted truncate">{line}</span>}
          </span>
          <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-paper">{jobs.length}</span>
          {open ? <ChevronDown size={16} className="shrink-0 text-ink2" /> : <ChevronRight size={16} className="shrink-0 text-ink2" />}
        </button>
      </div>
      {drop?.active && <p className="px-4 pb-2 text-[11px] font-semibold text-brand-green">{drop.hint}</p>}
      {open && (
        <>
          {canChange && (
            <div className="flex gap-4 px-4 pb-2 pl-[60px] text-xs font-semibold">
              <button type="button" onClick={onRename} className="text-brand-green hover:underline">{tr(lang, 'groupRename')}</button>
              <button type="button" onClick={onUngroup} className="text-bad hover:underline">{tr(lang, 'groupUngroup')}</button>
            </div>
          )}
          <ul className="relative space-y-1.5 border-t border-line bg-bg py-2 pl-5 pr-2 before:absolute before:left-[10px] before:top-3 before:bottom-3 before:w-0.5 before:rounded before:bg-brand-green before:opacity-40">
            {jobs.map(j => renderJob(j, titleInGroup(titleOf(j), group.name)))}
          </ul>
        </>
      )}
    </li>
  )
}
