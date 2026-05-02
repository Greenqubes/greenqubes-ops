/**
 * Monday 9 AM SGT digest.
 * Pulls last week's asst_chats with importance >= 4, summarises each via Claude,
 * and sends to scheduler/owner via Telegram with one-tap "promote to Obsidian" links.
 *
 * Scheduled via: GitHub Actions cron (0 1 * * 1  — 09:00 SGT = 01:00 UTC)
 * Populated in: migration step 9 (obsidian-sync + monday-digest)
 */

export {}
