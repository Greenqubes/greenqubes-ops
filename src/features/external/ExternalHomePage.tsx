'use client'

import { useEffect, useState } from 'react'
import { Layers, Ban } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ExternalJobDetail } from './ExternalJobDetail'
import { fmtExtDate, fmtExtTime, todayIso } from './format'
import type { ExtJobSummary } from '@/lib/supabase/queries/external'

interface Props { token: string }

// The external contact's whole world: one bookmarked URL, every job they've
// ever been assigned. No login — the token IS the identity. Standalone page,
// no CompanyBar / BottomNav / i18n (external contacts get English).
export function ExternalHomePage({ token }: Props) {
  const [state,    setState]    = useState<'loading' | 'valid' | 'invalid' | 'error'>('loading')
  const [contact,  setContact]  = useState<{ name: string } | null>(null)
  const [jobs,     setJobs]     = useState<ExtJobSummary[]>([])
  const [selected, setSelected] = useState<ExtJobSummary | null>(null)
  const [busy,     setBusy]     = useState<string | null>(null)   // job_id being answered

  useEffect(() => {
    let cancelled = false
    fetch(`/api/ext/${token}`)
      .then(async r => {
        if (cancelled) return
        if (r.status === 404 || r.status === 410) { setState('invalid'); return }
        if (!r.ok) { setState('error'); return }
        const data: { contact: { name: string }; jobs: ExtJobSummary[] } = await r.json()
        setContact(data.contact)
        setJobs(data.jobs)
        setState('valid')
      })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [token])

  const respond = async (jobId: string, response: 'accepted' | 'declined') => {
    setBusy(jobId)
    try {
      const res = await fetch(`/api/ext/${token}/respond`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ job_id: jobId, response }),
      })
      if (!res.ok) throw new Error()
      setJobs(prev => prev.map(j => j.job_id === jobId ? { ...j, status: response } : j))
    } catch {
      // leave the card as-is — they can tap again
    } finally {
      setBusy(null)
    }
  }

  const brandBar = (
    <div className="bg-ink px-4 py-3 flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-md bg-brand-green flex items-center justify-center shrink-0">
        <Layers size={14} className="text-white" />
      </div>
      <p className="text-sm font-bold text-white">GreenQubes</p>
    </div>
  )

  if (state === 'loading' || state === 'error') {
    return (
      <div className="min-h-screen bg-bg">
        {brandBar}
        <p className="p-10 text-center text-sm text-muted">
          {state === 'loading' ? 'Loading…' : 'Something went wrong. Please try again later.'}
        </p>
      </div>
    )
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        {brandBar}
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5 px-8 text-center">
          <div className="w-14 h-14 rounded-full bg-paper border-[1.5px] border-line flex items-center justify-center mb-1">
            <Ban size={24} className="text-muted" strokeWidth={1.8} />
          </div>
          <h1 className="text-base font-bold text-ink">This link is no longer valid</h1>
          <p className="text-sm text-ink2 leading-relaxed max-w-xs">
            Your link has been deactivated. Please contact the person in-charge at
            GreenQubes directly.
          </p>
        </div>
      </div>
    )
  }

  if (selected) {
    return <ExternalJobDetail token={token} summary={selected} onBack={() => setSelected(null)} />
  }

  const today    = todayIso()
  const pending  = jobs.filter(j => j.status === 'pending' && j.job.job_status !== 'completed')
  const upcoming = jobs.filter(j =>
    j.status === 'accepted' && j.job.job_status !== 'completed' &&
    (j.job.date_end ?? j.job.date) >= today,
  )
  const past = jobs.filter(j =>
    (j.status === 'accepted' && (j.job.job_status === 'completed' || (j.job.date_end ?? j.job.date) < today)) ||
    j.status === 'declined',
  )

  const metaChips = (j: ExtJobSummary) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-bg text-ink2">
        {fmtExtDate(j.job.date)}
        {j.job.date_end && j.job.date_end !== j.job.date ? ` – ${fmtExtDate(j.job.date_end)}` : ''}
      </span>
      {j.job.punctuality === 'strict' ? (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-terracotta-soft text-terracotta">
          {j.job.time_start ? `Strict ${fmtExtTime(j.job.time_start)}` : 'Strict'}
        </span>
      ) : (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-blue-soft text-brand-blue">
          Flexible window
        </span>
      )}
      {j.job.time_start && (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-bg text-ink2">
          {fmtExtTime(j.job.time_start)}{j.job.time_end ? ` – ${fmtExtTime(j.job.time_end)}` : ''}
        </span>
      )}
    </div>
  )

  const sectionHead = (label: string, count: number, tone?: 'red' | 'green') => (
    <div className="flex items-center justify-between px-4 pt-4 pb-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
      <span
        className={cn(
          'text-[10px] font-bold rounded-full px-1.5 py-px',
          tone === 'red'   ? 'bg-terracotta-soft text-terracotta' :
          tone === 'green' ? 'bg-brand-green-soft text-brand-green' :
          'bg-line text-ink2',
        )}
      >
        {count}
      </span>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg pb-10">
      {brandBar}

      {/* Greeting */}
      <div className="bg-paper border-b border-line px-4 pt-4 pb-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-0.5">Your jobs</p>
        <h1 className="text-xl font-bold text-ink">{contact?.name}</h1>
        <p className="text-[11px] text-muted mt-0.5">
          {pending.length + upcoming.length} active
          {pending.length > 0 && ` · ${pending.length} need${pending.length === 1 ? 's' : ''} your response`}
        </p>
      </div>

      <div className="max-w-md mx-auto">
        {/* Needs response */}
        {pending.length > 0 && (
          <>
            {sectionHead('Needs response', pending.length, 'red')}
            {pending.map(j => (
              <div
                key={j.job_id}
                className="mx-3 mb-2 rounded-xl border-[1.5px] border-terracotta/30 bg-paper overflow-hidden"
              >
                <div className="px-3.5 pt-3 pb-2.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink truncate">
                        {j.job.project_title || j.job.client}
                      </p>
                      <p className="text-[11px] text-muted truncate">{j.job.client}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-terracotta-soft text-terracotta shrink-0">
                      Pending
                    </span>
                  </div>
                  {metaChips(j)}
                </div>
                <div className="flex gap-2 px-3.5 pb-3">
                  <button
                    type="button"
                    disabled={busy === j.job_id}
                    onClick={() => respond(j.job_id, 'accepted')}
                    className="flex-1 py-2 rounded-lg bg-brand-green text-white text-xs font-bold disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy === j.job_id}
                    onClick={() => respond(j.job_id, 'declined')}
                    className="flex-1 py-2 rounded-lg border-[1.5px] border-line bg-paper text-terracotta text-xs font-bold disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <>
            {sectionHead('Upcoming', upcoming.length, 'green')}
            {upcoming.map(j => (
              <button
                key={j.job_id}
                type="button"
                onClick={() => setSelected(j)}
                className="mx-3 mb-2 w-[calc(100%-1.5rem)] rounded-xl border-[1.5px] border-line bg-paper px-3.5 pt-3 pb-2.5 text-left"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">
                      {j.job.project_title || j.job.client}
                    </p>
                    <p className="text-[11px] text-muted truncate">{j.job.client}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-green-soft text-brand-green shrink-0">
                    Accepted
                  </span>
                </div>
                {metaChips(j)}
              </button>
            ))}
          </>
        )}

        {/* Past / declined */}
        {past.length > 0 && (
          <>
            {sectionHead('Past', past.length)}
            {past.map(j => {
              const isDone = j.status === 'accepted'
              return (
                <div
                  key={j.job_id}
                  role={isDone ? 'button' : undefined}
                  onClick={isDone ? () => setSelected(j) : undefined}
                  className={cn(
                    'mx-3 mb-2 rounded-xl border-[1.5px] border-line bg-paper px-3.5 pt-3 pb-2.5 opacity-60',
                    isDone && 'cursor-pointer',
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        {j.job.project_title || j.job.client}
                      </p>
                      <p className="text-[11px] text-muted truncate">{j.job.client}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-bg text-muted shrink-0">
                      {isDone ? 'Done' : 'Declined'}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-bg text-ink2">
                    {fmtExtDate(j.job.date)}
                  </span>
                </div>
              )
            })}
          </>
        )}

        {jobs.length === 0 && (
          <p className="p-10 text-center text-sm text-muted">No jobs assigned yet.</p>
        )}
      </div>
    </div>
  )
}
