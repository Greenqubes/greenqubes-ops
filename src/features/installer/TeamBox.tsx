import { cn } from '@/lib/utils/cn'
import { t, type LangCode } from '@/lib/i18n'
import { noDriverYet, type Crew, type CrewPerson } from '@/lib/utils/installer-crew'

/**
 * Who is on the job, for installers — Nic's pick B (2026-11-07): their own
 * card shape with the crew in a box of pills, because installers "can't see
 * the installer name as prominent as office view". Rows: Driver (green),
 * Support Crew (neutral), External (dashed) — an empty row is left out, and
 * the Driver row says "No driver yet" when the scheduler's driver board would
 * call the job Unassigned. The person looking at the screen is a black pill.
 */
export function TeamBox({ crew, lang, size = 'big' }: { crew: Crew; lang: LangCode; size?: 'big' | 'compact' }) {
  const open = noDriverYet(crew)
  const rows: Array<{ label: string; people: CrewPerson[]; kind: 'driver' | 'support' | 'external' }> = [
    { label: t(lang, 'metaDriver'),      people: crew.drivers,   kind: 'driver' },
    { label: t(lang, 'teamSupportCrew'), people: crew.support,   kind: 'support' },
    { label: t(lang, 'teamExternal'),    people: crew.externals, kind: 'external' },
  ]

  return (
    <div className="rounded-[10px] border border-line bg-bg px-2.5 py-2 space-y-1.5">
      {rows.map(row => {
        const showOpen = row.kind === 'driver' && open
        if (!showOpen && row.people.length === 0) return null
        return (
          <div key={row.kind} className="flex items-start gap-2">
            <span className="w-[84px] shrink-0 pt-0.5 text-xs font-semibold text-ink2">{row.label}</span>
            <div className="flex min-w-0 flex-wrap gap-1">
              {showOpen
                ? <span className="pt-0.5 text-xs italic text-muted">{t(lang, 'noDriverYet')}</span>
                : row.people.map((p, i) => (
                    <span key={`${p.name}-${i}`} className={cn(
                      'inline-block rounded-full border font-medium',
                      size === 'big' ? 'px-2.5 py-0.5 text-[13px]' : 'px-2 py-[1px] text-[11px]',
                      p.you                   ? 'border-ink bg-ink text-paper'
                      : row.kind === 'driver' ? 'border-brand-green/30 bg-brand-green/10 text-brand-green'
                      : row.kind === 'external' ? 'border-dashed border-ink2/40 bg-paper text-ink2'
                      : 'border-line bg-paper text-ink2',
                    )}>{p.name}</span>
                  ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
