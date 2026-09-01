'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { computeUrgency, daysBetween, URGENCY_META } from '@/lib/utils/design-urgency'
import { JobCardContent } from './DesignerBar'
import type { MyDesignJob } from '@/lib/supabase/queries/design-load'
import type { LangCode } from '@/lib/i18n'

type Bucket = 'todo' | 'ready' | 'past'

// To-do: design not completed yet.
// Ready to install: design completed, job not marked completed, install date
// today-or-future.
// Past: design completed and (job status completed OR install date already
// past).
function bucketOf(job: MyDesignJob, todayISO: string): Bucket {
  if (job.designCompletedAt === null) return 'todo'
  if (job.status === 'completed') return 'past'
  if (job.installDate !== null && job.installDate < todayISO) return 'past'
  return 'ready'
}

const CHIPS: { id: Bucket; key: 'myJobsTodo' | 'myJobsReady' | 'myJobsPast' }[] = [
  { id: 'todo',  key: 'myJobsTodo'  },
  { id: 'ready', key: 'myJobsReady' },
  { id: 'past',  key: 'myJobsPast'  },
]

interface Props {
  jobs:         MyDesignJob[] | null
  loading:      boolean
  todayISO:     string
  lang:         LangCode
  // The REAL board-wide max open-jobs-per-designer, computed once by
  // DesignLoadShell alongside the bars (same value DesignerBar's segments
  // use). Threading the same number through here — rather than each view
  // computing its own — is what makes a given job's urgency level agree
  // between the Board bubble and its My Jobs row.
  maxOpenCount: number
}

export function MyJobsView({ jobs, loading, todayISO, lang, maxOpenCount }: Props) {
  const router = useRouter()
  const [bucket, setBucket] = useState<Bucket>('todo')

  const buckets = useMemo(() => {
    const grouped: Record<Bucket, MyDesignJob[]> = { todo: [], ready: [], past: [] }
    for (const job of jobs ?? []) grouped[bucketOf(job, todayISO)].push(job)
    return grouped
  }, [jobs, todayISO])

  // This designer's own To-do count feeds computeUrgency's congestion ratio
  // alongside the real board-wide maxOpenCount above. If the board data is
  // somehow absent (maxOpenCount is 0 — no designers/jobs at all board-wide,
  // which also means computeUrgency's own maxOpenCount>0 guard would no-op
  // the bump anyway), fall back to 0 rather than self-referencing a count
  // with no board context to compare against.
  const openCount = maxOpenCount > 0 ? buckets.todo.length : 0
  const rows = buckets[bucket]

  if (loading && jobs === null) {
    return <p className="text-center text-sm text-muted py-12">{t(lang, 'loading')}</p>
  }

  return (
    <div className="px-4 pt-4">
      <div className="flex gap-2 mb-4 flex-wrap">
        {CHIPS.map(chip => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setBucket(chip.id)}
            className={cn(
              'px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors',
              bucket === chip.id
                ? 'bg-brand-blue text-white border-brand-blue'
                : 'bg-bg border-line text-ink2',
            )}
          >
            {t(lang, chip.key)} · {buckets[chip.id].length}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-sm text-muted py-12">{t(lang, 'noJobs')}</p>
      ) : (
        <div className="flex flex-col gap-2 pb-4">
          {rows.map(job => {
            const daysToDue = job.dueDate ? daysBetween(todayISO, job.dueDate) : null
            const level = computeUrgency({
              complexity: job.complexity, daysToDue, openCount, maxOpenCount,
            })
            return (
              <button
                key={job.jobId}
                type="button"
                onClick={() => router.push(`/jobs/${job.jobId}`)}
                className="flex items-start gap-2 text-left rounded-card border border-line bg-paper p-3 w-full"
              >
                {bucket === 'todo' && (
                  <span
                    className={cn('mt-1 shrink-0 w-2.5 h-2.5 rounded-full', URGENCY_META[level].barClass)}
                    aria-hidden
                  />
                )}
                <JobCardContent job={job} lang={lang} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
