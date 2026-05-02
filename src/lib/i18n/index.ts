import { en, type Translations } from './en'
import { zh } from './zh'
import { bn } from './bn'

export type { Translations }
export type LangCode = 'en' | 'zh' | 'bn'

export const LANGS = [
  { code: 'en' as LangCode, label: 'English', native: 'English' },
  { code: 'zh' as LangCode, label: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'bn' as LangCode, label: 'Bengali', native: 'বাংলা' },
]

const translations: Record<LangCode, Partial<Translations>> = { en, zh, bn }

export function t(lang: LangCode, key: keyof Translations): string {
  return (translations[lang][key] ?? en[key]) as string
}

export { en, zh, bn }
