/**
 * Nightly Obsidian vault → Supabase sync.
 * Walks the vault, chunks each .md file (~500 tokens), embeds via Voyage AI,
 * and upserts to kb_chunks with visibility/tags from YAML frontmatter.
 *
 * Scheduled via: GitHub Actions cron / Vercel Cron / server Task Scheduler
 * Populated in: migration step 9 (obsidian-sync + monday-digest)
 */

export {}
