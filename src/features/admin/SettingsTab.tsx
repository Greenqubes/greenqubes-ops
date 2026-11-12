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
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">{error ?? 'Loading…'}</p>
        <JobsheetCard />
      </div>
    )
  }

  const shown = pending ?? data.retention
  const warnCount = pending ? data.expiringByOption[pending] : 0

  return (
    <div className="space-y-4">
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
    <JobsheetCard />
    </div>
  )
}

// Admin → Settings → Old jobsheet (Nic, 2026-11-11; spec Part 2). The private
// link the script inside the old "Greenqubes Jobs" Google Sheet reads, so the
// app's scheduled jobs fill each weekly tab below a yellow bar. Anyone with
// the link can read those jobs, so only admin sees it, and Change link kills
// the old one at once. English only, like the rest of this tab.
function JobsheetCard() {
  const [link, setLink]         = useState<string | null | undefined>(undefined)
  const [busy, setBusy]         = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [note, setNote]         = useState<string | null>(null)
  // The script to paste into the sheet, fetched up front so Copy script can
  // write it inside the tap itself (phones refuse a copy after a wait).
  const [script, setScript]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/jobsheet-link')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { link: string | null }) => setLink(d.link))
      .catch(() => setNote('Could not load the link.'))
    fetch('/api/admin/jobsheet-script')
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(setScript)
      .catch(() => { /* the button says so if pressed */ })
  }, [])

  async function makeLink() {
    setBusy(true)
    setNote(null)
    try {
      const res = await fetch('/api/admin/jobsheet-link', { method: 'POST' })
      if (!res.ok) { setNote('Could not make a new link. The old one still works.'); return }
      const d = await res.json() as { link: string }
      setLink(d.link)
      setConfirming(false)
      setNote(link ? 'New link made. Paste it into the sheet (Greenqubes menu → Set app link).' : 'Link made.')
    } catch {
      setNote('No connection. Nothing changed.')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setNote('Link copied.')
    } catch {
      // Clipboard refused (older browsers, some app views): select the text instead.
      const el = document.getElementById('jobsheet-link')
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r) }
      setNote('Selected. Copy it from here.')
    }
  }

  async function copyScript() {
    if (!script) { setNote('Could not load the script. Reload the page and try again.'); return }
    try {
      await navigator.clipboard.writeText(script)
      setNote('Script copied. Paste it into the sheet (step 2 below).')
    } catch {
      setNote('Your browser blocked copying. Try again on a computer.')
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <p className="text-[11px] uppercase tracking-widest text-muted font-medium">Old jobsheet (Google Sheet)</p>
      <p className="text-sm text-ink2">
        A private link that fills the &ldquo;Greenqubes Jobs&rdquo; sheet with the app&rsquo;s scheduled jobs. Every hour,
        this week&rsquo;s and future weeks&rsquo; tabs are rewritten whole by the app. Past weeks are left as the record.
      </p>

      {link === undefined && !note && <p className="text-sm text-muted">Loading…</p>}

      {link === null && (
        <Btn size="sm" onClick={makeLink} disabled={busy}>{busy ? 'Making…' : 'Make link'}</Btn>
      )}

      {link && (
        <>
          <p id="jobsheet-link" className="rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs text-ink break-all select-all">{link}</p>
          {!confirming ? (
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" onClick={copy}>Copy link</Btn>
              <Btn size="sm" variant="secondary" onClick={copyScript}>Copy script</Btn>
              <Btn size="sm" variant="secondary" onClick={() => { setConfirming(true); setNote(null) }} disabled={busy}>Change link</Btn>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-bad">
                The old link stops working straight away. Paste the new one into the sheet&rsquo;s script
                (Greenqubes menu → Set app link).
              </p>
              <div className="flex gap-2">
                <Btn size="sm" onClick={makeLink} disabled={busy}>{busy ? 'Changing…' : 'Change'}</Btn>
                <Btn size="sm" variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Btn>
              </div>
            </div>
          )}
        </>
      )}

      {note && <p className="text-xs text-ink2">{note}</p>}

      <details className="text-sm text-ink2">
        <summary className="cursor-pointer text-ink font-medium">How to set it up</summary>
        <ol className="mt-2 list-decimal pl-5 space-y-1">
          <li>Press <b>Copy script</b> above. In the sheet, open <b>Extensions → Apps Script</b>.</li>
          <li>
            If the editor only shows an empty <code>function myFunction() {'{}'}</code>, replace it with the script. If there
            is other code there, leave it and add a new file instead (<b>+ → Script</b>) and paste into that. Press Save.
          </li>
          <li>Reload the sheet. A <b>Greenqubes</b> menu appears. Choose <b>Set app link</b> and paste the link above.</li>
          <li>
            Choose <b>Refresh now</b>. Google asks you to allow it: press Continue. If it says &ldquo;Google hasn&rsquo;t
            verified this app&rdquo;, that&rsquo;s normal for your own script: press Advanced, then Go to the project.
          </li>
          <li>Choose <b>Set up hourly refresh</b>. From then on it rewrites the weekly tabs every hour and makes the new ones.</li>
        </ol>
        <p className="mt-2">
          The app owns this week&rsquo;s and future weeks&rsquo; tabs: anything typed there is replaced on the next refresh,
          so add jobs in the app and share the sheet as Viewer. Updating from the older version: press <b>Copy script</b>
          and paste it over the old one. Try it on a copy of the sheet first (File → Make a copy).
        </p>
      </details>
    </Card>
  )
}
