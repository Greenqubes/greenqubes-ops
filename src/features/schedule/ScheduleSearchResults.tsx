'use client'

import { cn } from '@/lib/utils/cn'
import { t, type LangCode } from '@/lib/i18n'
import { highlightParts, type SearchDay } from '@/lib/utils/schedule-search'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'
import { fmtTime } from './utils'

/**
 * The schedule's search results, across ALL dates (Nic picked "results list",
 * 2026-10-26). Replaces the day / board / week / month while something is
 * typed; tapping a job hands it back so the page can jump to its date and
 * blink it. Rendered only after the user types, so nothing here meets the
 * server render (#418) — the dates still use static English names (hard rule).
 */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function Marked({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) => p.hit
        ? <mark key={i} className="rounded-[3px] bg-brand-amber-soft px-[1px] text-inherit">{p.text}</mark>
        : <span key={i}>{p.text}</span>)}
    </>
  )
}

const crewNames = (j: ScheduleJob) => [
  ...j.job_assignees.map(a => a.users?.name),
  ...(j.job_external_contacts ?? []).filter(e => !e.is_suggestion).map(e => e.external_contacts?.name),
].filter((n): n is string => !!n)

export function ScheduleSearchResults({ days, query, lang, onPick }: {
  days:   SearchDay<ScheduleJob>[]
  query:  string
  lang:   LangCode
  onPick: (job: ScheduleJob) => void
}) {
  const total = days.reduce((n, d) => n + d.jobs.length, 0)
  if (total === 0) {
    return <p className="mx-4 mt-2 rounded-xl border border-dashed border-line bg-paper px-4 py-6 text-center text-sm text-muted">{t(lang, 'myJobsNoMatch')}</p>
  }
  return (
    <div className="px-4 pb-24">
      <p className="mb-1 mt-1 text-xs text-ink2">{t(lang, 'scheduleSearchCount').replace('{n}', String(total))}</p>
      {days.map(day => (
        <section key={day.date}>
          <h3 className="mb-1.5 mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink2">
            {dayLabel(day.date)}
            {day.past && <span className="font-semibold normal-case tracking-normal text-brand-amber">· {t(lang, 'scheduleSearchPast')}</span>}
          </h3>
          <ul className="space-y-1.5">
            {day.jobs.map(j => {
              const crew = crewNames(j).join(', ')
              // The crew line only shows when it is why the job matched.
              const crewHit = crew && highlightParts(crew, query).some(p => p.hit)
              const time = j.time_start ? [fmtTime(j.time_start), fmtTime(j.time_end)].filter(Boolean).join(' – ') : ''
              return (
                <li key={j.id}>
                  <button type="button" onClick={() => onPick(j)}
                    className="flex w-full gap-3 rounded-xl border border-line bg-paper px-3 py-2.5 text-left hover:border-ink2">
                    <span className={cn('w-1 shrink-0 rounded-full', j.punctuality === 'strict' ? 'bg-punct-strict' : 'bg-punct-flex')} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-sm font-semibold text-ink">
                        <Marked text={j.project_title || j.client || 'Untitled job'} query={query} />
                      </span>
                      <span className="block truncate text-xs text-ink2">
                        <Marked text={[j.client, j.client_poc_name, j.location].filter(Boolean).join(' · ')} query={query} />
                      </span>
                      {crewHit && (
                        <span className="block truncate text-xs text-ink2">
                          {t(lang, 'scheduleSearchCrew')}: <Marked text={crew} query={query} />
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right text-xs font-semibold text-ink">
                      {time}
                      {j.date_end && j.date_end > j.date && (
                        <span className="block font-normal text-ink2">{t(lang, 'scheduleSearchUntil').replace('{date}', dayLabel(j.date_end))}</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
