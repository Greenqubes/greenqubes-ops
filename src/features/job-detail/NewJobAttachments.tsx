'use client'

import { useRef, useState } from 'react'
import { Paperclip, Trash2, Loader2 } from 'lucide-react'
import { Card } from '@/components/Card'
import { useToast } from '@/components/Toast'
import { t } from '@/lib/i18n'
import { DEFAULT_BUCKET_NAMES, type DefaultBucketName } from '@/lib/storage/new-job-attachments'
import type { LangCode } from '@/lib/i18n'

/** A file waiting in the holding area, and the bucket it is destined for. */
export type PendingAttachment = { key: string; name: string; bucket: DefaultBucketName }

interface Props {
  lang:     LangCode
  files:    PendingAttachment[]
  onChange: (files: PendingAttachment[]) => void
}

/**
 * Attachments on the New Job form (Nic, 2026-09-15).
 *
 * The card used to say "Save the job first", because a file needs a job to
 * belong to. Uploads now go to the person's own holding area and are copied
 * onto the job the moment it is created — so an abandoned draft takes its
 * files with it.
 *
 * It shows the SAME four buckets the job form does, rather than one flat
 * list: a sales person who files a permit under PERMIT-TO-WORK and then finds
 * it under OTHERS would reasonably think the file had moved on its own
 * (Nic's point). Bucket IDs do not exist yet, so each pending file carries
 * the bucket NAME and is matched up after the job is created.
 */
export function NewJobAttachments({ lang, files, onChange }: Props) {
  const { error: showError } = useToast()
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const [busyBucket, setBusyBucket] = useState<string | null>(null)

  async function upload(list: FileList, bucket: DefaultBucketName) {
    setBusyBucket(bucket)
    const added: PendingAttachment[] = []
    try {
      for (const file of Array.from(list)) {
        const res = await fetch('/api/jobs/new-attachment/upload-url', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            filename:    file.name,
            contentType: file.type || 'application/octet-stream',
            size:        file.size,
          }),
        })
        if (!res.ok) {
          // The real reason, not a catch-all: a generic "upload failed" is
          // what hid the video-upload bug for weeks (2026-09-14).
          const body = await res.json().catch(() => ({})) as { error?: string }
          showError(body.error ?? t(lang, 'saveError'))
          continue
        }
        const { url, key } = await res.json() as { url: string; key: string }

        const put = await fetch(url, {
          method:  'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body:    file,
        })
        // fetch only rejects on network failure, so an unchecked HTTP error
        // would pass as success and leave a file that opens to nothing.
        if (!put.ok) { showError(t(lang, 'saveError')); continue }

        added.push({ key, name: file.name, bucket })
      }
      if (added.length) onChange([...files, ...added])
    } finally {
      setBusyBucket(null)
      const input = inputs.current[bucket]
      if (input) input.value = ''
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-sm font-medium text-ink">{t(lang, 'attachments')}</h3>

      {DEFAULT_BUCKET_NAMES.map(bucket => {
        const mine = files.filter(f => f.bucket === bucket)
        const busy = busyBucket === bucket
        return (
          <div key={bucket} className="rounded-xl border border-line p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{bucket}</p>

            {mine.length > 0 && (
              <ul className="space-y-1.5">
                {mine.map(f => (
                  <li key={f.key} className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2">
                    <Paperclip size={13} className="shrink-0 text-muted" />
                    <span className="flex-1 min-w-0 truncate text-[13px] text-ink2">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => onChange(files.filter(x => x.key !== f.key))}
                      aria-label={t(lang, 'delete')}
                      className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-bad-soft hover:text-bad"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <input
              ref={el => { inputs.current[bucket] = el }}
              type="file"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files?.length) void upload(e.target.files, bucket) }}
            />
            <button
              type="button"
              onClick={() => inputs.current[bucket]?.click()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink2 transition-colors hover:bg-bg disabled:opacity-50"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
              {busy ? t(lang, 'loading') : t(lang, 'addAttachment')}
            </button>
          </div>
        )
      })}

      <p className="text-xs text-muted">{t(lang, 'newJobAttachmentNote')}</p>
    </Card>
  )
}
