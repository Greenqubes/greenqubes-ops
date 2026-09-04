import type { LangCode } from '@/lib/i18n'

// Some platforms (Android WebView, older Chrome) report voice langs with an
// underscore ("zh_CN") — normalise before comparing.
export interface SpeakableVoice { name: string; lang: string; localService: boolean }

// Same mapping the composer dictation mic uses: zh → Mandarin, everything
// else → Singapore English (bn voice is out of scope v1 — spec §2.3).
export function speechLangTag(lang: LangCode): string {
  return lang === 'zh' ? 'zh-CN' : 'en-SG'
}

// Exact-tag matches beat language-prefix matches; local voices beat remote
// within each tier (no network dependency, no first-utterance lag).
export function pickVoice(voices: SpeakableVoice[], tag: string): SpeakableVoice | null {
  const norm   = (l: string) => l.replace('_', '-').toLowerCase()
  const target = norm(tag)
  const prefix = target.split('-')[0]
  const rank = (v: SpeakableVoice): number => {
    const vl = norm(v.lang)
    if (vl === target) return v.localService ? 0 : 1
    if (vl.split('-')[0] === prefix) return v.localService ? 2 : 3
    return 4
  }
  const best = [...voices].sort((a, b) => rank(a) - rank(b))[0]
  return best && rank(best) < 4 ? best : null
}
