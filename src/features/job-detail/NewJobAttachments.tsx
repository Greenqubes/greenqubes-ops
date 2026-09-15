'use client'

import { useRef, useState } from 'react'
import { Paperclip, Trash2, Loader2 } from 'lucide-react'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { useToast } from '@/components/Toast'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'

/** A file waiting in the holding area for the job to be created. */
export type PendingAttachment = { key: string; name: string }

interface Props {
  lang:     LangCode
  files:    PendingAttachment[]
  onChange: (files: PendingAttachment[]) => void
}

/**
 * Attachments on the New Job form (Nic, 2026-09-15).
 *
 * The card used to say "Save the job first" because a file needs a job to
 * belong to. Uploads now go to the person's own holding area and are copied
 * onto the job the moment it is created — so the paperclip works before the
 * job exists, and an abandoned draft takes its files with it.
 *
 * No buckets here: there are none until the job is created. Everything lands
 * in OTHERS, and the job form's existing Move-to-bucket picker files it from
 * there.
 */
export function NewJobAttachments({ lang, files, onChange }: Props) {
  const { error: showError } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function upload(list: FileList) {
    setBusy(true)
    const added: PendingAttachment[] = []
    try {
      for (const file of Array.from(list)) {
        const res = await fetch('/api/jobs/new-attachment/upload-url', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size }),
        })
        if (!res.ok) {
          // Surface the real reason — a catch-all "upload failed" is what made
          // the video-upload bug invisible for weeks (2026-09-14).
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
        // fetch only rejects on network failure, so an HTTP error here would
        // otherwise pass as success and leave a file that opens to nothing.
        if (!put.ok) { showError(t(lang, 'saveError')); continue }

        added.push({ key, name: file.name })
      }
      if (added.length) onChange([...files, ...added])
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Card className="p-5 space-y-3">
      <h3 className="text-sm font-medium text-ink">{t(lang, 'attachments')}</h3>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map(f => (
            <li key={f.key} className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2">
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
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => { if (e.target.files?.length) void upload(e.target.files) }}
      />
      <Btn variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
        {busy ? t(lang, 'loading') : t(lang, 'addAttachment')}
      </Btn>

      <p className="text-xs text-muted">{t(lang, 'newJobAttachmentNote')}</p>
    </Card>
  )
}
