'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card }  from '@/components/Card'
import { Btn }   from '@/components/Btn'
import { cn }    from '@/lib/utils/cn'
import type { DigestItem, DigestSubscriber } from '@/lib/supabase/queries/admin'

type DigestData = { items: DigestItem[]; subscribers: DigestSubscriber[] }

// ── Subscriber panel ───────────────────────────────────────────────────────────

function SubscriberPanel({
  subscribers,
  onToggle,
}: {
  subscribers: DigestSubscriber[]
  onToggle: (id: string, val: boolean) => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)

  async function toggle(sub: DigestSubscriber) {
    setBusy(sub.id)
    await onToggle(sub.id, !sub.digest_subscriber)
    setBusy(null)
  }

  if (!subscribers.length) {
    return (
      <Card className="p-4">
        <p className="text-xs text-muted italic">
          No users have a Telegram Chat ID set. Add one in the Users tab first.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-3">
        Digest subscribers
      </p>
      <p className="text-xs text-muted mb-3">
        Only subscribed users receive the Monday digest. Check the box to subscribe.
      </p>
      <div className="flex flex-col divide-y divide-line">
        {subscribers.map(sub => (
          <label
            key={sub.id}
            className={cn(
              'flex items-center gap-3 py-2.5 cursor-pointer',
              busy === sub.id && 'opacity-50 pointer-events-none',
            )}
          >
            <input
              type="checkbox"
              className="accent-terracotta w-4 h-4 shrink-0"
              checked={sub.digest_subscriber}
              onChange={() => toggle(sub)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate">{sub.name}</p>
              <p className="text-xs text-muted font-mono">TG {sub.telegram_chat_id}</p>
            </div>
            <span className="text-xs text-muted shrink-0">{sub.role}</span>
          </label>
        ))}
      </div>
    </Card>
  )
}

// ── Importance stars ───────────────────────────────────────────────────────────

function Stars({ n }: { n: number | null }) {
  return (
    <span className="text-amber-500 text-xs" title={`Importance ${n ?? '?'}/5`}>
      {'★'.repeat(n ?? 0)}{'☆'.repeat(5 - (n ?? 0))}
    </span>
  )
}

// ── Status pill ────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: DigestItem['status'] }) {
  const styles: Record<DigestItem['status'], string> = {
    pending:   'bg-brand-amber/10 text-brand-amber border-brand-amber/20',
    promoted:  'bg-brand-green/10 text-brand-green border-brand-green/20',
    dismissed: 'bg-ink2/10 text-ink2 border-ink2/20',
  }
  return (
    <span className={cn('text-xs border rounded-full px-2 py-0.5 font-medium', styles[status])}>
      {status}
    </span>
  )
}

// ── Digest item card ───────────────────────────────────────────────────────────

function DigestItemCard({
  item,
  subscribers,
}: {
  item:        DigestItem
  subscribers: DigestSubscriber[]
}) {
  const subscribed  = subscribers.filter(s => s.digest_subscriber)
  const [selected,  setSelected]  = useState<Set<string>>(new Set(subscribed.map(s => s.id)))
  const [expanded,  setExpanded]  = useState(false)
  const [sending,   setSending]   = useState(false)
  const [feedback,  setFeedback]  = useState<string | null>(null)

  // Re-sync default selection when subscribers change
  useEffect(() => {
    setSelected(new Set(subscribed.map(s => s.id)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribers.length])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function send() {
    if (!selected.size) return
    setSending(true); setFeedback(null)
    try {
      const res = await fetch('/api/admin/digest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chatId: item.id, subscriberIds: [...selected] }),
      })
      const json = await res.json() as { sent: number; total: number; error?: string }
      if (!res.ok) throw new Error(json.error)
      setFeedback(`Sent to ${json.sent} of ${json.total} subscriber${json.total !== 1 ? 's' : ''}`)
    } catch (err) {
      setFeedback(`Error: ${(err as Error).message}`)
    } finally {
      setSending(false)
    }
  }

  const date = new Date(item.ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })

  return (
    <Card className="p-4">
      {/* Header row */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-display font-medium text-ink text-sm truncate">
            {item.topic ?? 'Untitled conversation'}
          </p>
          <p className="text-xs text-muted">{date}</p>
        </div>
        <StatusPill status={item.status} />
      </div>

      {/* Stars + vote count */}
      <div className="flex items-center gap-3 mb-3">
        <Stars n={item.importance} />
        <span className="text-xs text-muted">
          {item.yes_votes} yes · {item.no_votes} no
        </span>
        {item.tags?.length ? (
          <span className="text-xs text-muted truncate">{item.tags.slice(0, 3).join(', ')}</span>
        ) : null}
      </div>

      {/* Send to section */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="text-xs text-muted hover:text-ink2 underline underline-offset-2 mb-2"
      >
        {expanded ? '− Hide send options' : '+ Send to subscribers…'}
      </button>

      {expanded && (
        <div className="border border-line rounded-lg p-3 flex flex-col gap-2">
          {subscribed.length === 0 ? (
            <p className="text-xs text-muted italic">No subscribers with Telegram IDs.</p>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-widest text-muted font-medium">
                Send to (checkmark = include)
              </p>
              <div className="flex flex-col gap-1.5">
                {subscribed.map(sub => (
                  <label key={sub.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-terracotta w-4 h-4"
                      checked={selected.has(sub.id)}
                      onChange={() => toggle(sub.id)}
                    />
                    <span className="text-sm text-ink">{sub.name}</span>
                    <span className="text-xs text-muted font-mono ml-auto">TG {sub.telegram_chat_id}</span>
                  </label>
                ))}
              </div>
              <Btn
                variant="accent"
                size="sm"
                onClick={send}
                disabled={sending || selected.size === 0}
              >
                {sending ? 'Sending…' : `Send to ${selected.size} subscriber${selected.size !== 1 ? 's' : ''}`}
              </Btn>
              {feedback && (
                <p className="text-xs text-muted">{feedback}</p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Tab root ───────────────────────────────────────────────────────────────────

export function DigestTab() {
  const [data,    setData]    = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadErr(null)
    try {
      const res  = await fetch('/api/admin/digest')
      const json = await res.json() as DigestData | { error: string }
      if (!res.ok) throw new Error((json as { error: string }).error ?? `HTTP ${res.status}`)
      setData(json as DigestData)
    } catch (err) {
      setLoadErr((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleSubscriber(id: string, val: boolean) {
    await fetch(`/api/admin/users/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ digest_subscriber: val }),
    })
    await load()
  }

  if (loading) return <p className="text-sm text-muted py-6 text-center">Loading…</p>
  if (loadErr) return (
    <div className="rounded-card border border-terracotta/30 bg-terracotta/5 p-4">
      <p className="text-sm font-medium text-terracotta mb-1">Failed to load digest data</p>
      <p className="text-xs text-ink2">{loadErr}</p>
      <p className="text-xs text-muted mt-2">
        If this is a missing-column error, run <code className="font-mono">npx supabase db push</code> to apply migration 0006.
      </p>
      <button onClick={load} className="mt-2 text-xs text-muted underline underline-offset-2">Retry</button>
    </div>
  )
  if (!data) return null

  const { items, subscribers } = data

  return (
    <div className="lg:flex lg:gap-6 flex flex-col gap-4">
      {/* Subscriber management — fixed width sidebar on desktop */}
      <div className="lg:w-72 lg:shrink-0">
        <SubscriberPanel subscribers={subscribers} onToggle={toggleSubscriber} />
      </div>

      {/* Digest queue — takes remaining width */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-2">
          Digest queue ({items.length})
        </p>
        {items.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-muted italic">
              No conversations with importance ≥ 4 yet.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(item => (
              <DigestItemCard key={item.id} item={item} subscribers={subscribers} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
