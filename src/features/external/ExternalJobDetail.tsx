'use client'

import { useEffect, useState } from 'react'
import {
  ChevronLeft, Clock, MapPin, User, Download, FileText, Link2,
  ListChecks, Check, Map as MapIcon, Phone,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { fmtExtDate, fmtExtTime, fmtExtTimeRange } from './format'
import type { ExtJobSummary } from '@/lib/supabase/queries/external'

type Attachment = { id: string; kind: string; name: string; url: string }
type Task       = { id: string; text: string; is_completed: boolean; sort_order: number }

type DetailResponse = {
  job: {
    id: string; project_title: string | null; client: string; location: string
    date: string; date_end: string | null; time_start: string | null
    time_end: string | null; punctuality: string; status: string
    description: string | null; notes: string | null
    client_poc_name: string | null; client_poc_phone: string | null
  }
  attachments:     Attachment[]
  tasks:           Task[]
  personInCharge:  { name: string; phone: string | null } | null
}

interface Props {
  token:   string
  summary: ExtJobSummary
  onBack:  () => void
}

// Full job view on the external contact's link page — unlocked after they
// accepted the job. Chat is deliberately NOT wired (deferred): the person-
// in-charge card with a phone number stands in for it.
export function ExternalJobDetail({ token, summary, onBack }: Props) {
  const [detail,  setDetail]  = useState<DetailResponse | null>(null)
  const [failed,  setFailed]  = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/ext/${token}/job/${summary.job_id}`)
      .then(async r => {
        if (!r.ok) throw new Error()
        const data: DetailResponse = await r.json()
        if (!cancelled) setDetail(data)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [token, summary.job_id])

  const toggleTask = async (task: Task) => {
    if (!detail) return
    const next = !task.is_completed
    setDetail(prev => prev && ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === task.id ? { ...t, is_completed: next } : t),
    }))
    try {
      const res = await fetch(`/api/ext/${token}/tasks`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ job_id: summary.job_id, task_id: task.id, is_completed: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setDetail(prev => prev && ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === task.id ? { ...t, is_completed: !next } : t),
      }))
    }
  }

  const job   = detail?.job
  const notes = [job?.description, job?.notes].filter(Boolean).join('\n\n')
  const done  = detail?.tasks.filter(t => t.is_completed).length ?? 0
  const total = detail?.tasks.length ?? 0
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="min-h-screen bg-bg pb-8">
      {/* Back bar */}
      <button
        type="button"
        onClick={onBack}
        className="w-full flex items-center gap-1.5 bg-paper border-b border-line px-4 py-2.5 text-sm font-semibold text-brand-blue"
      >
        <ChevronLeft size={15} />
        All jobs
      </button>

      {/* Hero */}
      <div className="bg-paper border-b border-line px-4 pt-3.5 pb-3">
        <h1 className="text-lg font-bold text-ink leading-snug">
          {summary.job.project_title || summary.job.client}
        </h1>
        <p className="text-xs text-muted mb-2">{summary.job.client}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-bg text-ink2">
            {fmtExtDate(summary.job.date)}
            {summary.job.date_end && summary.job.date_end !== summary.job.date
              ? ` – ${fmtExtDate(summary.job.date_end)}` : ''}
          </span>
          {summary.job.punctuality === 'strict' ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-punct-strict-soft text-punct-strict">
              {summary.job.time_start ? `Strict ${fmtExtTime(summary.job.time_start)}` : 'Strict'}
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-punct-flex-soft text-punct-flex">
              Flexible window
            </span>
          )}
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-green-soft text-brand-green">
            Accepted
          </span>
        </div>
      </div>

      {failed && (
        <p className="px-4 py-8 text-center text-sm text-muted">
          Could not load this job. Pull to refresh or try again later.
        </p>
      )}

      {!detail && !failed && (
        <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
      )}

      {detail && job && (
        <div className="max-w-md mx-auto">
          {/* Key facts */}
          <div className="bg-paper mx-3 mt-3 rounded-xl border border-line overflow-hidden">
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 border-b border-bg">
              <Clock size={14} className="text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Time</p>
                <p className="text-sm font-medium text-ink">{fmtExtTimeRange(job.time_start, job.time_end)}</p>
                {job.punctuality === 'strict' && job.time_start && (
                  <p className="text-[11px] text-muted">Arrive by {fmtExtTime(job.time_start)} sharp</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 border-b border-bg">
              <MapPin size={14} className="text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Location</p>
                <p className="text-sm font-medium text-ink">{job.location || '—'}</p>
              </div>
            </div>
            {job.client_poc_name && (
              <div className="flex items-start gap-2.5 px-3.5 py-2.5">
                <User size={14} className="text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Site contact</p>
                  <p className="text-sm font-medium text-ink">{job.client_poc_name}</p>
                  {job.client_poc_phone && (
                    <a href={`tel:${job.client_poc_phone}`} className="text-[11px] text-brand-blue">
                      {job.client_poc_phone}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {notes && (
            <div className="mx-3 mt-2 rounded-xl border border-line bg-paper px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">Notes</p>
              <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {/* Tasks */}
          {total > 0 && (
            <div className="mx-3 mt-2 rounded-xl border border-line bg-paper overflow-hidden">
              <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1.5">
                  <ListChecks size={12} />
                  Tasks
                </p>
                {done === total && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-brand-green">
                    <Check size={12} strokeWidth={3} />
                    All done
                  </span>
                )}
              </div>
              <div className="px-3.5 pb-2">
                <div className="flex justify-between text-[11px] text-muted mb-1">
                  <span>{done} of {total} done</span>
                  <span className="font-semibold text-brand-green">{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-green transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="border-t border-bg">
                {detail.tasks.map(task => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => toggleTask(task)}
                    className="w-full flex items-start gap-2.5 px-3.5 py-2.5 border-b border-bg last:border-b-0 text-left"
                  >
                    <span
                      className={cn(
                        'w-5 h-5 rounded-md border-2 shrink-0 mt-px flex items-center justify-center transition-colors',
                        task.is_completed ? 'bg-brand-green border-brand-green' : 'bg-paper border-line',
                      )}
                    >
                      {task.is_completed && <Check size={12} strokeWidth={3} className="text-white" />}
                    </span>
                    <span
                      className={cn(
                        'text-sm leading-relaxed',
                        task.is_completed ? 'text-muted line-through' : 'text-ink',
                      )}
                    >
                      {task.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {detail.attachments.length > 0 && (
            <div className="mx-3 mt-2 rounded-xl border border-line bg-paper overflow-hidden">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted px-3.5 pt-2.5 pb-1.5 border-b border-bg">
                Attachments
              </p>
              {detail.attachments.map(a => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-bg last:border-b-0"
                >
                  {a.kind === 'url_link'
                    ? <Link2 size={16} className="text-brand-blue shrink-0" />
                    : <FileText size={16} className="text-terracotta shrink-0" />}
                  <span className="flex-1 min-w-0 text-xs font-medium text-ink truncate">{a.name}</span>
                  {a.kind !== 'url_link' && <Download size={13} className="text-ink2 shrink-0" />}
                </a>
              ))}
            </div>
          )}

          {/* Person-in-charge (chat deferred — call instead) */}
          <div className="mx-3 mt-2 rounded-xl border border-line bg-paper px-3.5 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
              Questions about this job?
            </p>
            {detail.personInCharge ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-ink">
                  Contact <span className="font-semibold">{detail.personInCharge.name}</span>, the person in-charge.
                </p>
                {detail.personInCharge.phone && (
                  <a
                    href={`tel:${detail.personInCharge.phone}`}
                    className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-white bg-brand-green rounded-lg px-3 py-2"
                  >
                    <Phone size={12} />
                    Call
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink">Contact the person in-charge directly.</p>
            )}
          </div>

          {/* Maps */}
          {job.location && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(job.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-3 mt-2 mb-4 flex items-center gap-2 rounded-xl border-[1.5px] border-line bg-bg px-3.5 py-2.5 text-sm font-semibold text-ink2"
            >
              <MapIcon size={14} />
              Open in Maps
            </a>
          )}
        </div>
      )}
    </div>
  )
}
