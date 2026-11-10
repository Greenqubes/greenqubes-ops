'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { t, type LangCode } from '@/lib/i18n'
import { useLiveChannel } from '@/lib/supabase/useLiveChannel'
import { CompanyBar } from '@/components/CompanyBar'
import { CompletedSwitch } from '@/components/CompletedSwitch'
import { BottomNav } from '@/components/BottomNav'
import { fmtTime } from '@/features/schedule/utils'
import { dayChipTone, shiftDay, weekOf, type AllJobsCard } from '@/lib/utils/all-jobs'
import { TeamBox } from './TeamBox'

// Day and month names are ALWAYS English (hard rule), and fixed tables keep
// the server and browser rendering identical (no locale formatting).
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH     = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), m: m - 1, d }
}
const href = (day: string) => `/installer/all?day=${day}`

/**
 * Installer All Jobs (Nic, 2026-11-10): every confirmed job in the company
 * for a day, so a last-minute move by the scheduler doesn't catch anyone out.
 * Look-only — only the installer's own jobs open. Others' changes arrive on
 * the 2-minute refresh (installers' live updates only cover their own rows).
 */
export function AllJobsShell({ cards, day, today, lang }: {
  cards: AllJobsCard[]
  day:   string
  today: string
  lang:  LangCode
}) {
  const router = useRouter()
  useLiveChannel({
    name:    'installer-all-jobs-live',
    tables:  [{ table: 'jobs' }, { table: 'job_assignees' }],
    onEvent: () => router.refresh(),
    poll:    { ms: 2 * 60 * 1000, fn: () => router.refresh() },
  })

  const week = weekOf(day)
  const p = parts(day)
  const count = cards.length === 1 ? t(lang, 'allJobsOne') : `${cards.length} ${t(lang, 'allJobsMany')}`

  return (
    <div className="min-h-screen bg-bg">
      <CompanyBar lang={lang} role="installer" />
      <CompletedSwitch role="installer" current="all" lang={lang} />

      <div className="mx-auto max-w-xl px-4 pt-4 pb-10 space-y-3">
        {/* ── Day strip: a week at a time ── */}
        <div className="flex items-center gap-1">
          <Link href={href(shiftDay(day, -7))} aria-label="Previous week" className="p-1 text-ink2 hover:text-ink rounded">
            <ChevronLeft size={20} strokeWidth={2.5} />
          </Link>
          <div className="grid flex-1 grid-cols-7 gap-1">
            {week.map(d => {
              const q = parts(d)
              const tone = dayChipTone(d, day, today)
              const on = tone === 'on'
              return (
                <Link key={d} href={href(d)} aria-current={on ? 'date' : undefined}
                  className={cn(
                    'rounded-[10px] border py-1 text-center text-[11px] transition-colors',
                    tone === 'on'    ? 'border-ink bg-ink text-paper'
                    : tone === 'today' ? 'border-ink2 bg-paper text-ink2 hover:bg-bg'
                    : 'border-line bg-paper text-muted hover:bg-bg',
                  )}>
                  {DAY_SHORT[q.dow]}
                  <b className={cn('block text-[15px] font-semibold', on ? 'text-paper' : 'text-ink')}>{q.d}</b>
                </Link>
              )
            })}
          </div>
          <Link href={href(shiftDay(day, 7))} aria-label="Next week" className="p-1 text-ink2 hover:text-ink rounded">
            <ChevronRight size={20} strokeWidth={2.5} />
          </Link>
        </div>
        {!week.includes(today) && (
          <div className="text-center">
            <Link href={href(today)} className="text-xs font-semibold text-ink2 underline underline-offset-2">
              {t(lang, 'filterToday')}
            </Link>
          </div>
        )}

        {/* ── Day heading ── */}
        <div className="flex items-baseline justify-between text-xs font-semibold text-ink2">
          <span>{DAY_LONG[p.dow]} {p.d} {MONTH[p.m]}</span>
          <span>{count}</span>
        </div>

        {cards.length === 0 && (
          <p className="rounded-card border border-line bg-paper px-4 py-6 text-center text-sm text-muted">
            {t(lang, 'allJobsNone')}
          </p>
        )}

        {cards.map(c => <AllJobsCardView key={c.id} card={c} lang={lang} />)}
      </div>

      {/* Nav drawer (CompanyBar) replaces this below lg — same as My Jobs */}
      <div className="hidden lg:block">
        <BottomNav role="installer" />
      </div>
    </div>
  )
}

function AllJobsCardView({ card, lang }: { card: AllJobsCard; lang: LangCode }) {
  const time = card.time_start
    ? `${fmtTime(card.time_start)}${card.time_end ? ` – ${fmtTime(card.time_end)}` : ''}`
    : t(lang, 'fcfsAllDay')

  const body = (
    <div className="flex gap-3 p-4">
      <div className={cn('w-1.5 shrink-0 self-stretch rounded-full',
        card.punctuality === 'strict' ? 'bg-punct-strict' : 'bg-punct-flex')} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-sm font-semibold text-ink">
            <Clock size={12} className="shrink-0" />{time}
          </span>
          {card.mine && (
            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-paper">
              {t(lang, 'youreOnThis')}
            </span>
          )}
        </div>
        <p className="font-display font-medium text-ink">{card.title}</p>
        {card.location && (
          <div className="flex items-start gap-1.5 text-xs text-ink2">
            <MapPin size={11} className="mt-[3px] shrink-0" />
            <span className="min-w-0 break-words">{card.location}</span>
          </div>
        )}
        <div className="pt-1">
          <TeamBox crew={card.crew} lang={lang} size="compact" />
        </div>
      </div>
    </div>
  )

  // Only the installer's own jobs open; everyone else's are look-only.
  return card.mine ? (
    <Link href={`/jobs/${card.id}?from=installer`}
      className="block overflow-hidden rounded-card border-2 border-ink bg-paper transition-colors hover:bg-bg/60">
      {body}
    </Link>
  ) : (
    <div className="overflow-hidden rounded-card border border-line bg-paper">{body}</div>
  )
}
