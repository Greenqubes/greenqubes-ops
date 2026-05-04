'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card }  from '@/components/Card'
import { cn }    from '@/lib/utils/cn'
import type { HealthCheck, UsageSummary, UnusualEvent } from '@/lib/supabase/queries/admin'

type HealthData = {
  checks:  HealthCheck[]
  usage:   UsageSummary[]
  unusual: UnusualEvent[]
}

// ── Provider links — manual comparison shortcuts ──────────────────────────────
const PROVIDER_LINKS: Record<string, { label: string; url: string }> = {
  anthropic: { label: 'Anthropic dashboard', url: 'https://console.anthropic.com/settings/billing' },
  voyage:    { label: 'Voyage AI dashboard', url: 'https://dash.voyageai.com' },
  r2:        { label: 'Cloudflare dashboard', url: 'https://dash.cloudflare.com' },
  telegram:  { label: 'BotFather',            url: 'https://t.me/BotFather' },
}

// Anthropic pricing as of 2025 (Sonnet 4.6): $3/$15 per 1M in/out tokens
// Voyage AI (voyage-3): $0.06 per 1M tokens
const PRICING: Record<string, { inPer1M: number; outPer1M: number }> = {
  anthropic: { inPer1M: 3.00,  outPer1M: 15.00 },
  voyage:    { inPer1M: 0.06,  outPer1M: 0     },
}

// ── System health card ────────────────────────────────────────────────────────

function StatusDot({ status }: { status: HealthCheck['status'] }) {
  const colours = {
    ok:      'bg-brand-green',
    warn:    'bg-brand-amber',
    error:   'bg-terracotta',
    unknown: 'bg-muted',
  }
  return (
    <span className={cn('inline-block w-2 h-2 rounded-full shrink-0 mt-1', colours[status])} />
  )
}

function SystemChecks({ checks }: { checks: HealthCheck[] }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-3">
        System checks
      </p>
      <div className="flex flex-col divide-y divide-line">
        {checks.map(c => (
          <div key={c.label} className="flex items-start gap-3 py-2.5">
            <StatusDot status={c.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">{c.label}</p>
              <p className="text-xs text-muted">{c.detail}</p>
            </div>
            <span className={cn(
              'text-xs font-medium shrink-0',
              c.status === 'ok'      ? 'text-brand-green'  :
              c.status === 'warn'    ? 'text-brand-amber'  :
              c.status === 'error'   ? 'text-terracotta'   : 'text-muted',
            )}>
              {c.status}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Usage card (per service) ──────────────────────────────────────────────────

function UsageCard({ summary }: { summary: UsageSummary }) {
  const link     = PROVIDER_LINKS[summary.service]
  const pricing  = PRICING[summary.service]

  // Calculate expected cost from our token counts (sanity check)
  const calcCost = pricing
    ? (summary.total_tokens_in  / 1_000_000) * pricing.inPer1M
    + (summary.total_tokens_out / 1_000_000) * pricing.outPer1M
    : null

  // Discrepancy: our recorded estimated_cost vs recalculated from token counts
  const discrepancy = calcCost !== null
    ? Math.abs(summary.estimated_cost - calcCost)
    : null

  const fmt = (n: number) => n.toFixed(4)

  return (
    <Card className="p-4">
      {/* Service header */}
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-sm text-ink capitalize">{summary.service}</p>
        <span className="text-[11px] uppercase tracking-widest text-muted font-medium">
          last 30 days
        </span>
      </div>

      {/* Our records */}
      <div className="bg-bg rounded-lg p-3 mb-2 text-xs font-mono">
        <div className="flex justify-between mb-1">
          <span className="text-muted">Our records</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink2">{summary.call_count.toLocaleString()} calls</span>
          <span className="text-ink2">${fmt(summary.estimated_cost)}</span>
        </div>
        {summary.total_tokens_in > 0 && (
          <div className="flex justify-between mt-1 text-muted">
            <span>{summary.total_tokens_in.toLocaleString()} in</span>
            <span>{summary.total_tokens_out.toLocaleString()} out</span>
          </div>
        )}
      </div>

      {/* Provider comparison row */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">
          Compare against provider billing to detect key misuse.
        </span>
        {link && (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-blue underline underline-offset-2 shrink-0 ml-2"
          >
            {link.label} →
          </a>
        )}
      </div>

      {/* Anomaly card layout (populated manually until provider API is wired) */}
      <div className="mt-3 border border-line rounded-lg p-3 text-xs text-muted">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-ink2">Provider records</span>
          <span className="italic">manual check required</span>
        </div>
        <p className="leading-relaxed">
          Open the provider dashboard above, compare their billed call count and cost
          against our records. Any discrepancy means API key usage outside this app.
        </p>
        {discrepancy !== null && discrepancy > 0.01 && (
          <p className="mt-1 text-brand-amber">
            ⚠ Internal cost estimate drift: ${fmt(discrepancy)} — check token logging.
          </p>
        )}
      </div>
    </Card>
  )
}

// ── Empty usage placeholder ───────────────────────────────────────────────────

function UsagePlaceholder({ service }: { service: string }) {
  const link = PROVIDER_LINKS[service]
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-sm text-ink capitalize">{service}</p>
        <span className="text-xs text-muted italic">no calls logged yet</span>
      </div>
      <p className="text-xs text-muted mb-2">
        API usage logging starts once calls are made through the app.
      </p>
      {link && (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-blue underline underline-offset-2"
        >
          {link.label} →
        </a>
      )}
    </Card>
  )
}

// ── Unusual activity feed ─────────────────────────────────────────────────────

function UnusualFeed({ events }: { events: UnusualEvent[] }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-3">
        Unusual activity — last 7 days
      </p>
      {events.length === 0 ? (
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-brand-green" />
          <p className="text-sm text-ink">No anomalies detected. All clear.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map(ev => {
            const sgt = new Date(new Date(ev.ts).getTime() + 8 * 60 * 60 * 1000)
            const label = sgt.toLocaleString('en-SG', {
              weekday: 'short', day: 'numeric', month: 'short',
              hour: '2-digit', minute: '2-digit',
              timeZone: 'UTC',
            })
            return (
              <div key={ev.id} className="flex items-start gap-3 p-3 bg-brand-amber/5 border border-brand-amber/20 rounded-lg">
                <span className="text-brand-amber text-base shrink-0">⚠</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink">
                    {label} SGT · {ev.service} / {ev.endpoint}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{ev.reason}</p>
                  {ev.ip_address && (
                    <p className="text-xs font-mono text-muted mt-0.5">IP: {ev.ip_address}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── Key rotation helpers ──────────────────────────────────────────────────────

function KeyRotationCard() {
  const links = [
    { label: 'Rotate Anthropic key',  url: 'https://console.anthropic.com/settings/keys' },
    { label: 'Rotate Voyage AI key',  url: 'https://dash.voyageai.com/api-keys' },
    { label: 'Rotate Cloudflare key', url: 'https://dash.cloudflare.com/profile/api-tokens' },
    { label: 'Rotate Supabase key',   url: 'https://supabase.com/dashboard/project/_/settings/api' },
  ]
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-3">
        Emergency key rotation
      </p>
      <p className="text-xs text-muted mb-3">
        If you see unexplained usage, rotate the affected key immediately, then update
        your <span className="font-mono">.env.local</span> and redeploy to Vercel.
      </p>
      <div className="flex flex-col gap-2">
        {links.map(({ label, url }) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between text-sm text-brand-blue underline underline-offset-2 hover:text-ink"
          >
            {label}
            <span className="text-muted text-xs">→</span>
          </a>
        ))}
      </div>
    </Card>
  )
}

// ── Tab root ──────────────────────────────────────────────────────────────────

const ALL_SERVICES = ['anthropic', 'voyage', 'r2', 'telegram']

export function HealthTab() {
  const [data,    setData]    = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadErr(null)
    try {
      const res  = await fetch('/api/admin/health')
      const json = await res.json() as HealthData | { error: string }
      if (!res.ok) throw new Error((json as { error: string }).error ?? `HTTP ${res.status}`)
      setData(json as HealthData)
    } catch (err) {
      setLoadErr((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="text-sm text-muted py-6 text-center">Running checks…</p>
  if (loadErr) return (
    <div className="rounded-card border border-terracotta/30 bg-terracotta/5 p-4">
      <p className="text-sm font-medium text-terracotta mb-1">Failed to load health data</p>
      <p className="text-xs text-ink2">{loadErr}</p>
      <button onClick={load} className="mt-2 text-xs text-muted underline underline-offset-2">Retry</button>
    </div>
  )
  if (!data) return null

  const usageMap = new Map(data.usage.map(u => [u.service, u]))
  const servicesWithData = new Set(data.usage.map(u => u.service))

  return (
    <div className="flex flex-col gap-6 pb-4">

      {/* Top row: system checks + key rotation side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SystemChecks checks={data.checks} />
        <KeyRotationCard />
      </div>

      {/* API usage tracker */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-1">
          API usage tracker — last 30 days
        </p>
        <p className="text-xs text-muted mb-3">
          Compare our internal logs against each provider's billing page to detect
          API key misuse outside this app.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {ALL_SERVICES.map(svc =>
            servicesWithData.has(svc)
              ? <UsageCard key={svc} summary={usageMap.get(svc)!} />
              : <UsagePlaceholder key={svc} service={svc} />,
          )}
        </div>
      </div>

      {/* Unusual activity — full width */}
      <UnusualFeed events={data.unusual} />

      <button
        onClick={load}
        className="text-xs text-muted underline underline-offset-2 hover:text-ink2 text-center pb-2"
      >
        Refresh
      </button>
    </div>
  )
}
