'use client'

import { useState } from 'react'
import { Briefcase, MapPin } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import { mapsSearchUrl } from '@/lib/utils/job-form-rules'
import { awayWhenLabel, type AwayTrip } from '@/lib/utils/away-overlap'

export { buildAwayByDate } from '@/lib/utils/away-overlap'

interface Props {
  trips: AwayTrip[]
  label: string
  lang:  LangCode
}

// Amber "Away" notice, directly under On leave. Each line is tappable and opens
// the trip's details — shown to EVERY role (Nic, 2026-10-09): a work trip is
// not private, unlike a leave reason, which never reaches this component.
export function AwayStrip({ trips, label, lang }: Props) {
  const [open, setOpen] = useState<AwayTrip | null>(null)
  if (trips.length === 0) return null
  const maps = open ? mapsSearchUrl(open.location) : null

  return (
    <>
      <div className="flex items-start gap-2.5 rounded-[10px] border border-brand-amber bg-brand-amber-soft px-3 py-2.5">
        <Briefcase size={16} className="text-brand-amber shrink-0 mt-0.5" strokeWidth={1.8} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-amber leading-none">{label}</p>
          <div className="mt-1 flex flex-col gap-0.5 min-w-0">
            {trips.map(trip => (
              <button
                key={trip.id}
                type="button"
                onClick={() => setOpen(trip)}
                className="text-left text-sm font-semibold text-ink hover:underline min-w-0 truncate"
              >
                {trip.people.map(p => p.name).join(', ')}
                <span className="font-normal text-ink2"> · {trip.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Modal isOpen={open !== null} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        {open && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="font-semibold text-ink">{open.people.map(p => p.name).join(', ')}</p>
            {open.business && <p className="text-ink2">{open.business}</p>}
            <p className="text-ink2">{awayWhenLabel(open)}</p>
            {open.location && (
              <p className="flex items-start gap-1.5 text-ink2">
                <MapPin size={14} className="shrink-0 mt-0.5" />
                <span className="min-w-0">{open.location}</span>
              </p>
            )}
            {maps && (
              <a href={maps} target="_blank" rel="noreferrer" className="text-terracotta text-sm font-medium hover:underline">
                {t(lang, 'awayOpenMaps')}
              </a>
            )}
            {open.note && <p className="text-ink2 whitespace-pre-wrap">{open.note}</p>}
          </div>
        )}
      </Modal>
    </>
  )
}
