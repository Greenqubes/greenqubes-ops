import type { Translations } from '@/lib/i18n'

// SSE status key → i18n label key. Unknown keys deliberately fall back to
// "Thinking…" so the server can add tools without a client release.
const STATUS_I18N: Record<string, keyof Translations> = {
  searching: 'assistantSearching',
  kb:        'assistantSearchingKb',
  schedule:  'assistantCheckingSchedule',
  jobs:      'assistantFindingJobs',
  job:       'assistantLookingUpJob',
  workload:  'assistantCheckingWorkload',
  clashes:   'assistantCheckingClashes',
  creating:  'assistantCreatingJob',
}

export function statusLabelKey(status: string | undefined): keyof Translations {
  return STATUS_I18N[status ?? ''] ?? 'assistantThinking'
}
