'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { JobRow } from './JobRow'
import { useCardDrag } from './useCardDrag'
import { CrewChangeModal } from './CrewChangeModal'
import {
  buildBands, planDrag, externalCrew, mainCrew, isMirrorCard, countRealJobs,
  type Band, type DragPlan, type DriverRef,
} from '@/lib/utils/driver-board'
import type { ScheduleJob } from '@/lib/supabase/queries/jobs'

interface Props {
  jobs:        ScheduleJob[]
  drivers:     DriverRef[]
  supportPool: DriverRef[]
  /** Scheduler and admin only — everyone else reads the board (Nic, 2026-09-15). */
  canDrag:     boolean
  currentDate: string
}

/**
 * Three FIXED bands, top to bottom: Mixed Drivers, every driver, any external
 * installer holding work, Unassigned.
 *
 * A band is always in the same place — that is the point. One flowing grid
 * reshuffles as the day fills, so the scheduler would have to hunt. More
 * drivers push Unassigned DOWN, never aside (Nic's words, 2026-09-15).
 *
 * Mixed Drivers holds 2+ driver jobs ONLY, and is what makes the board
 * honest: a shared job appears exactly once, with every driver named on it,
 * instead of being filed under one driver (leaving the other's day
 * incomplete) or duplicated into both.
 *
 * Column count follows the screen, set by the width at which a card stops
 * being readable rather than by what fits: below ~700px per card the crew
 * column crowds the address, which is the very thing the card redesign
 * exists to expose.
 */
export function DriverBoard({ jobs, drivers, supportPool, canDrag, currentDate }: Props) {
  const router = useRouter()
  const [plan, setPlan] = useState<{ plan: DragPlan; job: ScheduleJob } | null>(null)

  const bands = useMemo(() => buildBands(jobs, drivers), [jobs, drivers])

  // Read AFTER mount and starting at 1, so the first render matches the
  // server's — /schedule is hydration-sensitive (#418) and must not be given
  // a reason to differ. Same rule ListView and DateStrip follow.
  const [driverCols, setDriverCols] = useState(1)
  useEffect(() => {
    const read = () => setDriverCols(
      window.matchMedia('(min-width: 2200px)').matches ? 3
        : window.matchMedia('(min-width: 1600px)').matches ? 2
        : 1,
    )
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  const { draggingId, hoverBandId, startDrag, registerBand } = useCardDrag({
    onDrop: (jobId, bandId) => {
      const job = jobs.find(j => j.id === jobId)
      if (!job) return
      const p = planDrag(job, bandId, drivers)
      if (!p) return              // dropped on its own band — a no-op, not a prompt
      setPlan({ plan: p, job })
    },
  })

  function renderBand(band: Band<ScheduleJob>) {
    // External containers are display-only (Nic, 2026-09-16): assigning an
    // outside contractor stays on the job form. NOT registering them means
    // hit-testing can never return one, so a card dropped over an external
    // simply snaps back — no prompt, nothing written.
    const droppable = band.kind !== 'external'

    return (
      <section
        key={band.id}
        ref={el => { if (droppable) registerBand(band.id, el) }}
        className={cn(
          'rounded-card border p-3 transition-colors',
          hoverBandId === band.id && draggingId ? 'border-terracotta bg-terracotta-soft' : 'border-line bg-bg',
          band.kind === 'unassigned' && 'border-dashed',
          band.kind === 'external'   && 'border-dashed border-brand-blue',
        )}
      >
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="font-display text-[15px] font-semibold text-ink">
            {band.kind === 'mixed'        ? 'Mixed Drivers'
             : band.kind === 'unassigned' ? 'Unassigned'
             : band.driver!.name}
          </h2>
          {band.kind === 'external' && (
            <span className="rounded-full border border-brand-blue bg-brand-blue-soft px-2 py-[1px] text-[10px] font-semibold text-brand-blue">
              External
            </span>
          )}
          <span className="ml-auto text-[11px] text-muted">
            {band.jobs.length === 0 ? 'nothing today' : `${band.jobs.length} job${band.jobs.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {band.jobs.map(job => {
          // A mirror is a read-only view of a job that lives in a driver's
          // container. It gets no drag handle: the drag acts on the JOB, so
          // two draggable cards for one job is how a board starts
          // contradicting itself.
          const mirror = isMirrorCard(job, band.id)
          return (
            <div key={`${band.id}:${job.id}`}>
              {mirror && (
                <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  <Link2 size={11} />
                  Same job — also with {mainCrew(job).map(d => d.name).join(', ')}
                </p>
              )}
              <JobRow
                job={job}
                currentDate={currentDate}
                dragging={draggingId === job.id}
                onDragHandle={canDrag && !mirror ? e => startDrag(job.id, e) : undefined}
              />
            </div>
          )
        })}
      </section>
    )
  }

  const mixed      = bands.filter(b => b.kind === 'mixed')
  const driverBand = bands.filter(b => b.kind === 'driver')
  const external   = bands.filter(b => b.kind === 'external')
  const unassigned = bands.filter(b => b.kind === 'unassigned')

  return (
    <div className="space-y-3">
      {/* The honest number. A shared job renders twice, so adding up the band
          counts would tell the scheduler there is more work than there is. */}
      <p className="text-[11px] text-muted">
        {countRealJobs(bands)} job{countRealJobs(bands) === 1 ? '' : 's'} today
      </p>

      {mixed.map(renderBand)}

      {/* Drivers are PEOPLE, not an ordered sequence, so they run left to
          right and wrap. */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: `repeat(${driverCols}, minmax(0, 1fr))`,
          gap:                 '0.75rem',
          alignItems:          'start',
        }}
      >
        {driverBand.map(renderBand)}
      </div>

      {/* External containers stay full width rather than joining the driver
          grid: they come and go with the day's work, and slotting them into
          the grid would shift the drivers' fixed positions — the one thing
          the band layout exists to prevent. */}
      {external.map(renderBand)}

      {unassigned.map(renderBand)}

      {plan && (
        <CrewChangeModal
          plan={plan.plan}
          job={{ id: plan.job.id, title: plan.job.project_title || plan.job.client || 'Untitled job' }}
          drivers={drivers}
          supportPool={supportPool}
          externals={externalCrew(plan.job)}
          onClose={() => setPlan(null)}
          onSaved={() => { setPlan(null); router.refresh() }}
        />
      )}
    </div>
  )
}
