'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { t, type LangCode } from '@/lib/i18n'

/**
 * "Client said no", "Can't fit — send back" and "Withdraw offer" all ask one
 * thing: why. The first two need an answer (the other side acts on it); a
 * withdraw may go without one.
 */
export function ArrangeReasonDialog({ open, title, required, busy, lang, onClose, onSend }: {
  open:     boolean
  title:    string
  required: boolean
  busy:     boolean
  lang:     LangCode
  onClose:  () => void
  onSend:   (text: string) => void
}) {
  const [text, setText] = useState('')
  useEffect(() => { if (open) setText('') }, [open])
  const blocked = busy || (required && !text.trim())

  return (
    <Modal isOpen={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={500}
          placeholder={t(lang, required ? 'arrangeReasonPlaceholder' : 'arrangeReasonOptional')}
          className="w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink2" />
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-[10px] border border-line bg-paper text-sm font-medium text-ink2 hover:bg-bg">
            {t(lang, 'cancel')}
          </button>
          <button type="button" disabled={blocked} onClick={() => onSend(text.trim())}
            className="flex-1 px-4 py-2.5 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40">
            {t(lang, 'arrangeConfirm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
