'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Btn } from '@/components/Btn'
import { Field } from '@/components/Field'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'

interface Props {
  client:    string
  lang:      LangCode
  onConfirm: (note: string) => void
  onClose:   () => void
}

export function SendBackModal({ client, lang, onConfirm, onClose }: Props) {
  const [note,      setNote]      = useState('')
  const [suggesting, setSuggesting] = useState(false)

  async function handleSuggest() {
    if (!note.trim() || suggesting) return
    setSuggesting(true)
    try {
      const res = await fetch('/api/suggest-grammar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: note }),
      })
      if (res.ok) {
        const { corrected } = await res.json() as { corrected: string }
        if (corrected) setNote(corrected)
      }
    } catch { /* best-effort */ } finally {
      setSuggesting(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose}>
      <div className="space-y-5">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">
            {t(lang, 'sendBackHeading')}
          </h2>
          <p className="mt-1 text-sm text-ink2">{client}</p>
        </div>

        <Field label={t(lang, 'sendBackNote')}>
          <div className="space-y-2">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t(lang, 'sendBackNotePlaceholder')}
              rows={3}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-terracotta resize-none"
            />
            <button
              type="button"
              onClick={handleSuggest}
              disabled={!note.trim() || suggesting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-[11px] font-medium text-ink2 hover:border-terracotta hover:text-terracotta transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {suggesting
                ? <Loader2 size={11} className="animate-spin" />
                : <Sparkles size={11} />
              }
              {suggesting ? 'Fixing…' : 'Suggest'}
            </button>
          </div>
        </Field>

        <div className="flex gap-2 justify-end">
          <Btn variant="secondary" size="sm" onClick={onClose}>
            {t(lang, 'cancel')}
          </Btn>
          <Btn variant="primary" size="sm" onClick={() => onConfirm(note)}>
            {t(lang, 'sendBackConfirm')}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
