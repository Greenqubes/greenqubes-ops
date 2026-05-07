'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { Paperclip, Link as LinkIcon } from 'lucide-react'
import type { LangCode } from '@/lib/i18n'

const TEXTAREA = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 resize-none'

interface Props {
  jobId:  string
  userId: string
  lang:   LangCode
}

export function PendingFilesSection({ jobId, userId, lang }: Props) {
  const { success: showSuccess, error: showError } = useToast()
  const supabase = createClient()
  const router   = useRouter()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [uploading,  setUploading]  = useState(false)
  const [urls,       setUrls]       = useState('')
  const [savingUrls, setSavingUrls] = useState(false)

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    e.target.value = ''

    setUploading(true)
    try {
      for (const file of selected) {
        const urlRes = await fetch('/api/r2/upload-url', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ jobId, kind: 'attachment', filename: file.name, contentType: file.type || 'application/octet-stream' }),
        })
        const { url, key } = await urlRes.json() as { url: string; key: string }

        await fetch(url, {
          method:  'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body:    file,
        })

        await supabase.from('files').insert({
          job_id:      jobId,
          kind:        'attachment',
          r2_key:      key,
          uploader_id: userId,
          visibility:  ['public-internal'],
        } as never).throwOnError()
      }
      showSuccess(t(lang, 'savedSuccessfully'))
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setUploading(false)
    }
  }

  const handleSaveUrls = async () => {
    const lines = urls.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return
    setSavingUrls(true)
    try {
      for (const url of lines) {
        await supabase.from('files').insert({
          job_id:      jobId,
          kind:        'url_link',
          r2_key:      url,
          uploader_id: userId,
          visibility:  ['public-internal'],
        } as never).throwOnError()
      }
      setUrls('')
      router.refresh()
      showSuccess(t(lang, 'savedSuccessfully'))
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setSavingUrls(false)
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-sm font-medium text-ink">{t(lang, 'pendingFiles')}</h3>

      {/* Multi-file upload */}
      <div>
        <input
          type="file"
          ref={fileRef}
          onChange={handleFiles}
          multiple
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.mp4,.mov"
        />
        <Btn
          variant="secondary"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Paperclip size={13} />
          {uploading ? t(lang, 'uploading') : t(lang, 'attachFiles')}
        </Btn>
      </div>

      {/* URL links */}
      <div className="space-y-2">
        <p className="text-xs text-muted uppercase tracking-wide">{t(lang, 'urlLinks')}</p>
        <textarea
          value={urls}
          onChange={e => setUrls(e.target.value)}
          rows={3}
          placeholder={t(lang, 'urlLinksPlaceholder')}
          className={TEXTAREA}
        />
        <Btn
          variant="secondary"
          size="sm"
          onClick={handleSaveUrls}
          disabled={savingUrls || !urls.trim()}
        >
          <LinkIcon size={13} />
          {savingUrls ? t(lang, 'loading') : t(lang, 'saveLinks')}
        </Btn>
      </div>
    </Card>
  )
}
