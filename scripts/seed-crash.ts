// Run after migration 0007: npx tsx scripts/seed-crash.ts
// Seeds two test crash entries so the Admin Crashes tab has something to display.
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase/types'

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const crashes = [
  {
    route:         '/schedule',
    error_message: "TypeError: Cannot read properties of undefined (reading 'map')",
    stack_trace:   [
      "TypeError: Cannot read properties of undefined (reading 'map')",
      '    at ScheduleShell (src/features/schedule/ScheduleShell.tsx:142:18)',
      '    at renderWithHooks (react-dom/cjs/react-dom.development.js:14985:18)',
      '    at mountIndeterminateComponent (react-dom/cjs/react-dom.development.js:17811:13)',
    ].join('\n'),
    component_stack: [
      '    at ScheduleShell',
      '    at ToastProvider',
      '    at ErrorBoundary',
    ].join('\n'),
    user_email: 'ai@greenqubes.com',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    markdown_body: [
      '# Crash — 2026-05-04 14:32 SGT',
      '',
      '**Route:** /schedule',
      '**User:** ai@greenqubes.com',
      '**UA:** Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      '',
      '## Error',
      "TypeError: Cannot read properties of undefined (reading 'map')",
      '',
      '## Stack',
      '```',
      "TypeError: Cannot read properties of undefined (reading 'map')",
      '    at ScheduleShell (src/features/schedule/ScheduleShell.tsx:142:18)',
      '```',
      '',
      '## Component stack',
      '```',
      '    at ScheduleShell',
      '    at ToastProvider',
      '```',
    ].join('\n'),
  },
  {
    route:         '/jobs/[id]',
    error_message: 'Error: Failed to fetch job data — network timeout after 30s',
    stack_trace:   [
      'Error: Failed to fetch job data — network timeout after 30s',
      '    at getJobById (src/lib/supabase/queries/jobs.ts:58:11)',
      '    at JobDetailShell (src/features/job-detail/JobDetailShell.tsx:34:22)',
    ].join('\n'),
    component_stack: null,
    user_email: null,
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    markdown_body: [
      '# Crash — 2026-05-04 09:11 SGT',
      '',
      '**Route:** /jobs/[id]',
      '**User:** unknown',
      '**UA:** Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      '',
      '## Error',
      'Error: Failed to fetch job data — network timeout after 30s',
      '',
      '## Stack',
      '```',
      'Error: Failed to fetch job data — network timeout after 30s',
      '    at getJobById (src/lib/supabase/queries/jobs.ts:58:11)',
      '    at JobDetailShell (src/features/job-detail/JobDetailShell.tsx:34:22)',
      '```',
    ].join('\n'),
  },
]

const { error } = await db.from('crash_logs').insert(crashes)
if (error) {
  console.error('Seed failed:', error.message)
  process.exit(1)
}
console.log(`Seeded ${crashes.length} crash entries.`)
