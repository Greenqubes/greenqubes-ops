'use client'

import { useState } from 'react'
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
  const [note, setNote] = useState('')

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
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t(lang, 'sendBackNotePlaceholder')}
            rows={3}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-terracotta resize-none"
          />
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
