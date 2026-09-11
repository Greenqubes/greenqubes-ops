'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { t, type LangCode } from '@/lib/i18n'
import { CHANGELOG, LATEST_CHANGELOG_DATE, changelogSeenKey, type ChangelogEntry } from '@/lib/changelog/entries'

/** Reopen from the profile menu without navigating (cf. the tour, which must). */
export const CHANGELOG_OPEN_EVENT = 'changelog:open'

// Date labels are ALWAYS English regardless of the reader's language
// (CLAUDE.md hard rule), so this is a fixed formatter, not toLocaleDateString.
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** '20:56' -> '8:56 PM'. Midnight and noon land on 12, not 0. */
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

/**
 * Bold for the part of a line that has to land — `**like this**`.
 * Deliberately the only markup entries support: they are read at a glance, and
 * a full markdown renderer invites formatting nobody asked for.
 */
function RichText({ text }: { text: string }) {
  // Odd positions are what sat between the asterisks.
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i} className="font-bold text-ink">{part}</strong>
          : part,
      )}
    </>
  )
}

/** One heading + its bullets. Renders nothing when the section is absent. */
function Section({ title, items, tone = 'normal' }: {
  title: string
  items?: string[]
  tone?: 'normal' | 'headsUp'
}) {
  if (!items || items.length === 0) return null
  return (
    <div className="mt-4 first:mt-0">
      {/* H3 — section heading */}
      <h3 className={
        tone === 'headsUp'
          ? 'text-sm font-semibold text-brand-amber'
          : 'text-sm font-semibold text-ink'
      }>
        {title}
      </h3>
      {/* Bullets sit one step below the H3 in size and weight, as Nic asked.
          Kept as a real <ul> rather than literal <h4> tags — a screen reader
          announcing every bullet as a heading makes the popup hard to move
          through, and the visual hierarchy is what was actually wanted. */}
      <ul className={
        tone === 'headsUp'
          ? 'mt-1.5 space-y-1.5 rounded-lg bg-brand-amber-soft px-3 py-2.5'
          : 'mt-1.5 space-y-1.5'
      }>
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink2">
            <span aria-hidden="true" className="select-none text-muted">•</span>
            <span><RichText text={item} /></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * One release. The date is a button that folds the release away (Nic,
 * 2026-09-10) — today's is open when the popup appears and every older one
 * starts closed, so the popup opens short and the history is there to dig
 * through rather than scroll past.
 */
function Entry({ entry, open, onToggle }: {
  entry:    ChangelogEntry
  open:     boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-line pb-5 last:border-b-0 last:pb-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        {/* H2 — the date */}
        <h2 className="font-display text-lg font-semibold text-ink">
          {formatDate(entry.date)}
          {entry.time && (
            <span className="ml-2 align-middle text-sm font-normal text-muted">
              {formatTime(entry.time)}
            </span>
          )}
        </h2>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn('shrink-0 text-muted transition-transform', !open && '-rotate-90')}
        />
      </button>
      {open && (
        <div className="mt-3">
          <Section title="Heads up"     items={entry.headsUp} tone="headsUp" />
          <Section title="New"          items={entry.added} />
          <Section title="Improved"     items={entry.improved} />
          <Section title="Fixed"        items={entry.fixed} />
          <Section title="Known issues" items={entry.known} />
        </div>
      )}
    </div>
  )
}

const newestDate = CHANGELOG[0] ? [CHANGELOG[0].date] : []

export function ChangelogModal({ lang = 'en' }: { lang?: LangCode }) {
  const [open, setOpen] = useState(false)
  // Which releases are unfolded. Newest open, older ones closed — reset every
  // time the popup opens, so it always starts the same way.
  const [openDates, setOpenDates] = useState<string[]>(newestDate)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => { if (open) setOpenDates(newestDate) }, [open])

  const toggleDate = useCallback((date: string) => {
    setOpenDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date])
  }, [])

  const markSeen = useCallback(() => {
    const id = userIdRef.current
    if (!id || !LATEST_CHANGELOG_DATE) return
    try { localStorage.setItem(changelogSeenKey(id), LATEST_CHANGELOG_DATE) } catch { /* best effort */ }
  }, [])

  // Auto-open once per person per device, only when the newest entry is one
  // they haven't seen. Storage can throw (private windows, blocked site data),
  // so a failure here must never stop the app — it just means no auto-open.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (CHANGELOG.length === 0) return
      const { data } = await createClient().auth.getUser()
      const id = data.user?.id
      if (cancelled || !id) return
      userIdRef.current = id
      let seen: string | null = null
      try { seen = localStorage.getItem(changelogSeenKey(id)) } catch { /* best effort */ }
      if (seen !== LATEST_CHANGELOG_DATE) setOpen(true)
    })()
    return () => { cancelled = true }
  }, [])

  // Reopened from the profile menu — always shows, seen or not.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(CHANGELOG_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(CHANGELOG_OPEN_EVENT, onOpen)
  }, [])

  const close = useCallback(() => { markSeen(); setOpen(false) }, [markSeen])

  if (CHANGELOG.length === 0) return null

  return (
    // Twice as wide on a PC (Nic, 2026-09-10 — it read too small there);
    // phones are unchanged, where the width is the screen anyway.
    <Modal isOpen={open} onClose={close} title={t(lang, 'changelogTitle')} className="max-w-lg lg:max-w-5xl">
      {/* Scrolls inside itself so a long history never grows the popup past
          the screen (Nic). max-h in vh so it adapts to a phone. */}
      <div className="max-h-[60vh] lg:max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        {CHANGELOG.map(entry => (
          <Entry
            key={entry.date}
            entry={entry}
            open={openDates.includes(entry.date)}
            onToggle={() => toggleDate(entry.date)}
          />
        ))}
      </div>
    </Modal>
  )
}
