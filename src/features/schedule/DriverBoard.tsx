'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { JobRow } from './JobRow'
import { useCardDrag } from './useCardDrag'
import { CrewChangeModal } from './CrewChangeModal'
import {
  buildBands, planDrag, externalCrew, mainCrew, isMirrorCard, countRealJobs, driverTint,
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
  /** Bulk selection, same as the list view — the tick boxes feed the
   *  delete / complete bar at the bottom of the page. */
  selectable?:  boolean
  selectedIds?: Set<string>
  onToggle?:    (id: string) => void
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
 * The driver containers sit in an `auto-fit` grid rather than at measured
 * breakpoints, so the browser fits as many as stay readable: three across on
 * a normal 1920 screen, two on a laptop, one on a phone. Nic, 2026-09-17 —
 * "scrolling down so much is a killer".
 */
export function DriverBoard({ jobs, drivers, supportPool, canDrag, currentDate, selectable, selectedIds, onToggle }: Props) {
  const router = useRouter()
  const [plan, setPlan] = useState<{ plan: DragPlan; job: ScheduleJob } | null>(null)

  const bands = useMemo(() => buildBands(jobs, drivers), [jobs, drivers])

  const { draggingId, hoverBandId, startDrag, registerBand, ghostRef } = useCardDrag({
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

    // One colour per driver (Nic, 2026-09-17), so a person is found by colour
    // before the name is read. Only the driver bands are tinted — Mixed,
    // Unassigned and the externals keep the neutral board background, which
    // is what makes the coloured ones stand out. An unlisted driver gets null
    // and falls back to neutral rather than an arbitrary colour.
    const tint = band.kind === 'driver' && band.driver ? driverTint(band.driver.name) : null
    // The drop highlight must win while a card is over the band, or the tint
    // would hide the one piece of feedback the drag depends on.
    const highlighted = hoverBandId === band.id && draggingId

    return (
      <section
        key={band.id}
        ref={el => { if (droppable) registerBand(band.id, el) }}
        style={tint && !highlighted ? { backgroundColor: tint } : undefined}
        className={cn(
          'rounded-card border p-3 transition-colors',
          highlighted ? 'border-terracotta bg-terracotta-soft'
                      : cn('border-line', !tint && 'bg-bg'),
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
          {/* An empty container stays quiet — "nothing today" is not a count
              and should not pull the eye the way a number does. */}
          {band.jobs.length === 0 ? (
            <span className="ml-auto text-[11px] text-muted">nothing today</span>
          ) : (
            <span className="ml-auto text-[15px] font-semibold text-ink leading-none">
              {band.jobs.length}
              <span className="ml-1 text-[12px] font-medium text-ink2">
                job{band.jobs.length === 1 ? '' : 's'}
              </span>
            </span>
          )}
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
                // A mirror is the same job as the driver's copy, so ticking
                // either shows both ticked — the Set is keyed by job id. Left
                // selectable on purpose: refusing it would be a surprise.
                selectable={selectable}
                selected={selectedIds?.has(job.id)}
                onToggle={onToggle}
              />
            </div>
          )
        })}
      </section>
    )
  }

  // What the ghost shows. Derived from draggingId, so it changes once per
  // drag rather than on every pointer move.
  const draggedJob = useMemo(() => {
    const j = jobs.find(x => x.id === draggingId)
    if (!j) return null
    return {
      title: j.project_title || j.client || 'Untitled job',
      sub:   j.location || '',
    }
  }, [jobs, draggingId])

  const mixed      = bands.filter(b => b.kind === 'mixed')
  const driverBand = bands.filter(b => b.kind === 'driver')
  const external   = bands.filter(b => b.kind === 'external')
  const unassigned = bands.filter(b => b.kind === 'unassigned')

  return (
    <div className="space-y-3">
      {/* The honest number. A shared job renders twice, so adding up the band
          counts would tell the scheduler there is more work than there is. */}
      <p className="flex items-baseline gap-1.5">
        <span className="font-display text-[22px] font-semibold text-ink leading-none">
          {countRealJobs(bands)}
        </span>
        <span className="text-[13px] font-medium text-ink2">
          job{countRealJobs(bands) === 1 ? '' : 's'} today
        </span>
      </p>

      {mixed.map(renderBand)}

      {/* Drivers are PEOPLE, not an ordered sequence, so they run left to
          right and wrap.
          `auto-fit` rather than a fixed column count at measured breakpoints:
          the browser fits as many containers as will stay readable, so all
          three drivers sit side by side on a normal 1920 screen (Nic,
          2026-09-17 — "scrolling down so much is a killer") and it still
          collapses to one on a phone. Pure CSS, so there is no resize
          listener and no first-render mismatch to manage — /schedule is
          hydration-sensitive (#418), and this removes the risk rather than
          working around it. 520px is the width below which the card's crew
          column starts crowding the address. */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))',
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

      {/* The card that follows the cursor. Always mounted so the hook's ref
          exists the instant a drag starts — it is hidden with display:none
          until it has a real position, which is why it never flashes at the
          top-left corner. pointer-events-none so it can never intercept the
          drop it is describing. */}
      <div
        ref={ghostRef}
        style={{ display: 'none', position: 'fixed', top: 0, left: 0 }}
        className="pointer-events-none z-[70] w-[280px] rounded-card border border-terracotta bg-paper px-3 py-2 shadow-lg"
      >
        <p className="truncate text-[13px] font-semibold text-ink">{draggedJob?.title ?? ''}</p>
        <p className="truncate text-[11px] text-muted">{draggedJob?.sub ?? ''}</p>
      </div>

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
