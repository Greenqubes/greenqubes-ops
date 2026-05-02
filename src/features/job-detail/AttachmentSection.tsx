'use client'

import { useState } from 'react'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { t } from '@/lib/i18n'
import { Download, FileText, Image } from 'lucide-react'
import type { JobFile } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

interface Props {
  files: JobFile[]
  lang:  LangCode
}

const kindLabel: Record<string, string> = {
  photo:      'Photo',
  do:         'DO',
  completion: 'Completion photo',
  attachment: 'Attachment',
}

function FileIcon({ kind }: { kind: string }) {
  if (kind === 'photo' || kind === 'completion') return <Image size={14} className="text-muted shrink-0" />
  return <FileText size={14} className="text-muted shrink-0" />
}

function DownloadButton({ r2Key, lang }: { r2Key: string; lang: LangCode }) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/r2/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: r2Key }),
      })
      const { url } = await res.json() as { url: string }
      window.open(url, '_blank', 'noopener')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Btn variant="ghost" size="sm" onClick={handleDownload} disabled={loading}>
      <Download size={13} />
      {t(lang, 'downloadFile')}
    </Btn>
  )
}

export function AttachmentSection({ files, lang }: Props) {
  if (files.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-medium text-ink mb-2">{t(lang, 'jobFiles')}</h3>
        <p className="text-sm text-muted">{t(lang, 'noFiles')}</p>
      </Card>
    )
  }

  return (
    <Card className="p-5 space-y-3">
      <h3 className="text-sm font-medium text-ink">{t(lang, 'jobFiles')}</h3>
      <ul className="divide-y divide-line">
        {files.map(file => {
          const filename = file.r2_key.split('/').pop() ?? file.r2_key
          return (
            <li key={file.id} className="flex items-center gap-3 py-2.5">
              <FileIcon kind={file.kind} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink truncate">{filename}</p>
                <p className="text-xs text-muted">{kindLabel[file.kind] ?? file.kind}</p>
              </div>
              <DownloadButton r2Key={file.r2_key} lang={lang} />
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
