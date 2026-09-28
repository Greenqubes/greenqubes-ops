// Translate a job description into the reader's own profile language
// (Nic, 2026-09-28). Read-only: the translation is shown to that one person
// under the description and never saved — sales wrote it, the team reads it,
// and overwriting it would hand everyone else a language they did not choose.
//
// English profiles get nothing ("english not necessary for translation").
// Bengali profiles DO get Bengali: the bn freeze is about hand-written UI
// strings, and this is machine-translated job content.

const TARGETS: Record<string, string> = {
  zh: 'Simplified Chinese',
  bn: 'Bengali',
}

/** The language a person's descriptions are translated into, or null when
 *  there is nothing to translate into (English, or no profile language). */
export function translateTarget(lang: string | null | undefined): string | null {
  if (!lang) return null
  return TARGETS[lang] ?? null
}

export function translateSystemPrompt(target: string): string {
  return [
    `Translate the job description you are given into ${target}.`,
    'It was written by office staff for the installers who will do the job, so keep it plain and practical.',
    'Keep dates, times, numbers, measurements and quantities exactly as written.',
    'Keep names of people, companies, brands, products and addresses exactly as written — do not translate or transliterate them.',
    `If part of the text is already in ${target}, leave that part as it is.`,
    'Return only the translation — no commentary, no notes, no markdown.',
  ].join(' ')
}
