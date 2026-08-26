'use client'

import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { BucketFile } from '@/lib/supabase/queries/jobs'

interface Props {
  file:    BucketFile
  buckets: { id: string; name: string }[]
  lang:    LangCode
  onClose: () => void
  onMoved: (fileId: string, toBucketId: string) => void
}

// z-[60]: overlays layer above BottomNav (hard rule) — and above the job
// form's z-50 modals for good measure. UI updates only on server success.
export function MoveFileModal({ file, buckets, lang, onClose, onMoved }: Props) {
  const [busy, setBusy] = useState(false)
  const { success: showSuccess, error: showError } = useToast()
  const targets  = buckets.filter(b => b.id !== file.bucket_id)
  const filename = file.name ?? file.url_text ?? file.r2_key.split('/').pop() ?? file.r2_key

  async function move(toBucketId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bucketId: toBucketId }),
      })
      if (!res.ok) { showError(t(lang, 'moveFileFailed')); return }
      onMoved(file.id, toBucketId)
      showSuccess(t(lang, 'fileMoved'))
      onClose()
    } catch {
      showError(t(lang, 'moveFileFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50" onClick={onClose}>
      <div className="bg-paper rounded-xl p-5 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
        <p className="font-display font-medium text-sm text-ink mb-1">{t(lang, 'moveFileTitle')}</p>
        <p className="text-xs text-muted truncate mb-3">{filename}</p>
        <div className="space-y-1">
          {targets.map(b => (
            <button
              key={b.id}
              type="button"
              disabled={busy}
              onClick={() => move(b.id)}
              className="w-full text-left px-3 py-2 rounded-lg border border-line text-[11px] font-semibold tracking-widest uppercase text-ink2 hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-50"
            >
              {b.name}
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-3">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg border border-line text-ink2">Cancel</button>
        </div>
      </div>
    </div>
  )
}
