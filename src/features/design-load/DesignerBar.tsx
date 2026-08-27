'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import { URGENCY_META } from '@/lib/utils/design-urgency'
import type { UrgencyLevel } from '@/lib/utils/design-urgency'
import type { DesignLoadJob } from '@/lib/supabase/queries/design-load'
import type { LangCode } from '@/lib/i18n'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // always English (CLAUDE.md hard rule)

// '2026-08-13' → '13/08 (Thu)' — static table, never toLocaleDateString (the
// locale formatters caused the /schedule hydration saga; never again).
// Mirrors NotificationDrawer's fmtOverdueDate.
export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const [, m, day] = iso.slice(0, 10).split('-')
  return `${day}/${m} (${DAYS[d.getDay()]})`
}

export type Segment = { job: DesignLoadJob; level: UrgencyLevel; height: number }

// --- Bubble geometry -------------------------------------------------------
// The bubble is `position: fixed` (viewport coordinates), computed from the
// hovered/tapped segment button's own getBoundingClientRect() — a *measured*
// placement, not an index/designer-count heuristic — so it's correct
// regardless of how narrow the columns get. `position: fixed` also means no
// ancestor's `overflow` can ever clip it (fixed escapes the normal
// containing-block/clipping chain up to the viewport unless an ancestor sets
// a transform/filter/will-change, none of which the board's containers do),
// which is what actually guarantees the old "clipped by the sticky header"
// bug can't recur — not just z-index winning a paint order race.
const BUBBLE_WIDTH = 224   // px — must match the `w-56` className below
const GAP = 8               // px — space between the bar/segment and the bubble
const EDGE_MARGIN = 8       // px — never render flush against a viewport edge
const HEADER_SAFE_TOP = 56  // px — taller than CompanyBar's own ~44px sticky height
const BOTTOM_SAFE = 88      // px — taller than BottomNav's ~64-80px (incl. safe-area)
const MIN_BUBBLE_HEIGHT = 160 // px — floor so the top-clamp still leaves room to read it
const MIN_VISIBLE_HEIGHT = 80 // px — hard floor even on a very short viewport (overflow-y:auto covers the rest)

export type BubblePos = { left: number; top: number; maxHeight: number }

// Pure + exported so the clamping guarantee is easy to verify by reading (or
// unit-testing) in isolation from React/DOM timing.
export function computeBubblePosition(anchor: DOMRect, viewportW: number, viewportH: number): BubblePos {
  const fitsRight = anchor.right + GAP + BUBBLE_WIDTH + EDGE_MARGIN <= viewportW
  let left = fitsRight ? anchor.right + GAP : anchor.left - GAP - BUBBLE_WIDTH
  // Hard clamp regardless of which branch fired above — guarantees the
  // bubble can never overflow either horizontal edge even if the fitsRight
  // guess and the actual rendered width disagree (e.g. a viewport narrower
  // than BUBBLE_WIDTH + 2*EDGE_MARGIN).
  left = Math.max(EDGE_MARGIN, Math.min(left, viewportW - BUBBLE_WIDTH - EDGE_MARGIN))

  // top is clamped into [HEADER_SAFE_TOP, hi] where hi is never below
  // HEADER_SAFE_TOP (Math.max floor) — so top >= HEADER_SAFE_TOP always
  // holds, by construction, which is the guarantee against ever rendering
  // above/under the sticky header again.
  const hi = Math.max(HEADER_SAFE_TOP, viewportH - BOTTOM_SAFE - MIN_BUBBLE_HEIGHT)
  const top = Math.min(Math.max(anchor.top, HEADER_SAFE_TOP), hi)

  // maxHeight caps whatever the browser renders so top + maxHeight never
  // pushes past the bottom-safe line either — with a hard visible floor for
  // the degenerate short-viewport case (content overflow-y:auto beyond it).
  const maxHeight = Math.max(MIN_VISIBLE_HEIGHT, viewportH - BOTTOM_SAFE - top)

  return { left, top, maxHeight }
}

// Shared content layout for both the board bubble and the My Jobs row cards
// (spec: "row card reuses the bubble's content layout"). `job` accepts the
// wider MyDesignJob shape too — structural typing, no cast needed.
export function JobCardContent({ job, lang }: { job: DesignLoadJob; lang: LangCode }) {
  return (
    <div className="min-w-0">
      <p className="font-display text-sm font-semibold text-ink truncate">
        {job.projectTitle || t(lang, 'untitledJob')}
      </p>
      <p className="text-xs text-muted truncate">{job.client || 'Untitled'}</p>
      {job.pocName && (
        <p className="text-[11px] text-ink2 mt-1 truncate">{t(lang, 'salesPOC')}: {job.pocName}</p>
      )}
      <div className="flex flex-col gap-0.5 mt-1.5 text-[11px] text-ink2">
        <span>Install: {fmtDate(job.installDate)}</span>
        <span>Due: {fmtDate(job.dueDate)}</span>
        <span className="text-muted">Created: {fmtDate(job.createdAt)}</span>
      </div>
      {job.reason && (
        <p className="text-[11px] text-muted mt-1.5 italic line-clamp-2">{job.reason}</p>
      )}
      {job.confidence === 'low' && (
        <span className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-amber-soft text-brand-amber">
          {t(lang, 'lowConfidence')}
        </span>
      )}
    </div>
  )
}

interface DesignerBarProps {
  designer: { id: string; name: string; jobs: DesignLoadJob[] }
  segments: Segment[]
  lang:     LangCode
}

export function DesignerBar({ designer, segments, lang }: DesignerBarProps) {
  const router = useRouter()
  const [openJobId, setOpenJobId] = useState<string | null>(null)
  // Tracks HOW the open bubble was opened. This matters because the
  // tap-away backdrop is a full-viewport `fixed` element with an explicit
  // z-index — it paints above the (un-indexed) segment buttons regardless
  // of DOM placement, so if it were mounted for a hover-opened bubble too,
  // the very next mousemove would hit-test onto the backdrop instead of the
  // segment/wrapper, firing `mouseleave` on the wrapper and instantly
  // closing the bubble it just opened. Only rendering the backdrop for
  // tap-opened bubbles keeps hover-close and tap-away-close from fighting.
  const [openViaTap, setOpenViaTap] = useState(false)
  // Computed fresh at open time from the triggering segment button's own
  // getBoundingClientRect() — see computeBubblePosition above for the
  // clamping guarantee. null whenever no bubble is open.
  const [bubblePos, setBubblePos] = useState<BubblePos | null>(null)

  const openSegment = segments.find(s => s.job.jobId === openJobId) ?? null

  const closeBubble = () => {
    setOpenJobId(null)
    setOpenViaTap(false)
    setBubblePos(null)
  }

  const positionFor = (e: React.MouseEvent<HTMLButtonElement>) =>
    computeBubblePosition(e.currentTarget.getBoundingClientRect(), window.innerWidth, window.innerHeight)

  // First tap opens the bubble; a second tap on the same segment (or a
  // desktop click, which lands after hover already opened it) navigates.
  const handleSegmentClick = (jobId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (openJobId === jobId) { router.push(`/jobs/${jobId}`); return }
    setOpenJobId(jobId)
    setOpenViaTap(true)
    setBubblePos(positionFor(e))
  }

  const handleSegmentHover = (jobId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    setOpenJobId(jobId)
    setOpenViaTap(false)
    setBubblePos(positionFor(e))
  }

  // A live refetch can drop the currently-open job out of `segments`
  // entirely (design marked complete, reassigned elsewhere, etc). Without
  // this, openJobId would keep pointing at a job that no longer exists —
  // openSegment goes null (bubble disappears) but a tap-opened backdrop
  // would stay mounted, silently eating the next tap anywhere on the page.
  useEffect(() => {
    if (openJobId && !segments.some(s => s.job.jobId === openJobId)) {
      setOpenJobId(null)
      setOpenViaTap(false)
      setBubblePos(null)
    }
  }, [segments, openJobId])

  // Data arrives newest-first (assignedAt DESC). The stack is bottom-aligned
  // via flex-col-reverse so the name label sits directly under it — with
  // that container reversal, the DOM order must be reversed too so the
  // newest job still ends up on top (segments newest-assigned on top).
  const stacked = [...segments].reverse()

  return (
    <>
      {/* Tap-away backdrop (mobile only — see openViaTap above for why
          hover-opened bubbles never mount this) — closes the bubble
          without navigating through whatever sits underneath, including
          the bottom nav. Rendered as a SIBLING of the hover-tracked
          wrapper below, not a descendant, so it doesn't itself change what
          counts as "inside the wrapper" for mouseleave purposes; also
          keeps it position:fixed and out of flex flow, so it doesn't
          disturb the bars row layout. */}
      {openJobId && openViaTap && (
        <div className="fixed inset-0 z-[59]" onClick={closeBubble} />
      )}

      <div
        // flex-1 + min-w-0: columns share the board's full width evenly and
        // squeeze as more designers are added (no horizontal scroll). No
        // longer `relative` — the bubble below is `position: fixed` (viewport
        // coordinates), not anchored to this column.
        className="flex flex-col items-center flex-1 min-w-0"
        onMouseLeave={closeBubble}
      >
        {segments.length === 0 ? (
          <div className="w-full max-w-8 aspect-square rounded border border-dashed border-line bg-muted/10" />
        ) : (
          // w-full (capped at 32px) instead of a fixed w-8: on a wide column
          // the bar sits at its normal ~32px cap; on a narrow column (many
          // designers / phone) it shrinks with the column. Segment HEIGHTS
          // (inline style below) never change — only this width does.
          <div className="flex flex-col-reverse gap-0.5 w-full max-w-8">
            {stacked.map(seg => (
              <button
                key={seg.job.jobId}
                type="button"
                onMouseEnter={e => handleSegmentHover(seg.job.jobId, e)}
                onClick={e => handleSegmentClick(seg.job.jobId, e)}
                className={cn('relative w-full rounded-[3px]', URGENCY_META[seg.level].barClass)}
                style={{ height: seg.height }}
                aria-label={seg.job.projectTitle || t(lang, 'untitledJob')}
              >
                {seg.job.confidence === 'low' && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-white ring-1 ring-ink/30" />
                )}
              </button>
            ))}
          </div>
        )}

        <p className="mt-1.5 text-[10px] font-medium text-ink2 text-center truncate w-full">
          {designer.name}
        </p>

        {openSegment && bubblePos && (
          // Rendered as a DOM descendant of the onMouseLeave wrapper above
          // (not a portal) on purpose: even though `fixed` positioning paints
          // it over a neighbouring column, hover/mouseleave hit-testing
          // follows DOM ancestry, so moving the pointer from the bar into
          // the bubble does NOT fire mouseleave on this wrapper and close it
          // early — "Open job" stays reachable. See computeBubblePosition
          // above for why top/left/maxHeight can never escape the viewport
          // or render behind the sticky header / bottom nav.
          <div
            className="fixed z-[60] w-56 rounded-card border border-line bg-paper shadow-lg p-3 overflow-y-auto"
            style={{ left: bubblePos.left, top: bubblePos.top, maxHeight: bubblePos.maxHeight }}
          >
            <JobCardContent job={openSegment.job} lang={lang} />
            <button
              type="button"
              onClick={() => router.push(`/jobs/${openSegment.job.jobId}`)}
              className="mt-2 w-full py-1.5 rounded-md bg-brand-blue text-white text-xs font-semibold"
            >
              {t(lang, 'openJobBtn')}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
