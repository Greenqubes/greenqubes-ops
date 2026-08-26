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
  jobs:     MyDesignJob[] | null
  loading:  boolean
  todayISO: string
  lang:     LangCode
}

export function MyJobsView({ jobs, loading, todayISO, lang }: Props) {
  const router = useRouter()
  const [bucket, setBucket] = useState<Bucket>('todo')

  const buckets = useMemo(() => {
    const grouped: Record<Bucket, MyDesignJob[]> = { todo: [], ready: [], past: [] }
    for (const job of jobs ?? []) grouped[bucketOf(job, todayISO)].push(job)
    return grouped
  }, [jobs, todayISO])

  // No cross-designer board context here (My Jobs is scoped to one
  // designer), so this designer's own To-do count doubles as both openCount
  // and maxOpenCount — the same congestion ratio the board uses to bump
  // urgency +1 once 3+ jobs are open.
  const openCount = buckets.todo.length
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
              complexity: job.complexity, daysToDue, openCount, maxOpenCount: openCount,
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
