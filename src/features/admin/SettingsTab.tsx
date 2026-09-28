'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/Card'
import { Btn }  from '@/components/Btn'
import type { RetentionKey } from '@/lib/utils/bin-rules'

type SettingsData = {
  retention:        RetentionKey
  options:          { key: RetentionKey; label: string }[]
  expiringByOption: Record<RetentionKey, number>
}

// Admin → Settings. How long the bin keeps deleted jobs, one value for
// everyone (Nic, 2026-09-28). Shortening it warns first: jobs already older
// than the new limit are emptied — files and all — at the next nightly run.
export function SettingsTab() {
  const [data, setData]       = useState<SettingsData | null>(null)
  const [pending, setPending] = useState<RetentionKey | null>(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/admin/settings')
    if (!res.ok) { setError('Could not load settings'); return }
    setData(await res.json())
  }
  useEffect(() => { void load() }, [])

  async function save(key: RetentionKey) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retention: key }),
      })
      if (!res.ok) { setError('Could not save — the setting is unchanged'); return }
      setPending(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  function choose(key: RetentionKey) {
    if (!data || key === data.retention) { setPending(null); return }
    if ((data.expiringByOption[key] ?? 0) > 0) setPending(key)   // warn first
    else void save(key)
  }

  if (!data) {
    return <p className="text-sm text-muted">{error ?? 'Loading…'}</p>
  }

  const shown = pending ?? data.retention
  const warnCount = pending ? data.expiringByOption[pending] : 0

  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-3">Bin</p>
      <label className="block text-sm text-ink2 mb-2" htmlFor="bin-retention">
        Deleted jobs can be restored for:
      </label>
      <select
        id="bin-retention"
        value={shown}
        disabled={saving}
        onChange={e => choose(e.target.value as RetentionKey)}
        className="w-full max-w-xs rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
      >
        {data.options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>

      {pending && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-bad">
            {warnCount} job{warnCount === 1 ? '' : 's'} already in the bin will be emptied tonight, files and all.
          </p>
          <div className="flex gap-2">
            <Btn size="sm" onClick={() => save(pending)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
            <Btn size="sm" variant="secondary" onClick={() => setPending(null)} disabled={saving}>Cancel</Btn>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-bad mt-2">{error}</p>}
    </Card>
  )
}
