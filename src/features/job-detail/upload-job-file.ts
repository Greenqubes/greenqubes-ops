'use client'
// The one way a photo-section file reaches a job from the job form: signed
// URL → R2 PUT → files row. Shared by Attach Files and Scan so both take the
// same checked path.
//
// Every step's failure throws with the real reason. History (Nic, 2026-09-14):
// a refused URL request used to be read straight through as { url, key },
// giving fetch(undefined) and a bare "Save failed"; and fetch only rejects on
// network failure, so an HTTP error on the PUT was ignored and the row written
// anyway — a file in the list that opened to nothing.

import type { createClient } from '@/lib/supabase/client'

export async function uploadJobFile({ supabase, jobId, userId, kind, body, filename, contentType }: {
  supabase: ReturnType<typeof createClient>
  jobId: string
  userId: string
  kind: 'production_instructions' | 'do' | 'completion'
  body: Blob
  filename: string
  contentType: string
}): Promise<void> {
  const urlRes = await fetch('/api/r2/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, kind, filename, contentType }),
  })
  if (!urlRes.ok) {
    const { error } = await urlRes.json().catch(() => ({ error: '' })) as { error?: string }
    throw new Error(error || `${urlRes.status}`)
  }
  const { url, key } = await urlRes.json() as { url: string; key: string }

  const putRes = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body })
  if (!putRes.ok) throw new Error(`storage ${putRes.status}`)

  await supabase.from('files').insert({
    job_id: jobId, kind, r2_key: key, name: filename, uploader_id: userId, visibility: ['public-internal'],
  } as never).throwOnError()
}
