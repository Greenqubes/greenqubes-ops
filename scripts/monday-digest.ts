/**
 * Monday digest — manual runner.
 * Run: npm run monday-digest
 * On Vercel this runs automatically via GET /api/cron/monday-digest (see vercel.json).
 */

import { runDigest } from '../src/lib/digest/run'

runDigest()
  .then(({ sent, skipped }) => {
    if (skipped) console.log(`[monday-digest] skipped — ${skipped}`)
    else         console.log(`[monday-digest] done — sent ${sent} items`)
  })
  .catch(err => {
    console.error('[monday-digest] fatal:', (err as Error).message)
    process.exit(1)
  })
