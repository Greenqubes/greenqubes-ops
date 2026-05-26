# Obsidian Vault Convention — Design Spec

**Date:** 2026-05-26
**Status:** Approved
**Scope:** Vault folder structure, file naming convention, frontmatter tagging, visibility rules, auto-write on digest promotion, manual override, adding new roles.

---

## What this covers

The Obsidian vault is the curated knowledge base for Greenqubes. It syncs nightly to Supabase (`kb_chunks`) and feeds the AI assistant's retrieval system. This spec defines how the vault is organised, how files are named, how access control is expressed via frontmatter, and how promoted assistant conversations are automatically written into the vault as notes.

This is separate from `asst_chats` — the raw conversation memory stored directly in Supabase. The vault holds intentional, authored knowledge. The assistant retrieves from both.

---

## Folder structure

```
vault/
  clients/      Client profiles, site preferences, contact gotchas
  suppliers/    Pricing, lead times, rep contacts
  sops/         Install playbooks, step-by-step procedures
  jobs/         Post-job lessons, what-went-wrong notes
  templates/    Quote, PTW, onboarding checklist masters
  contacts/     Venue managers, BCA, internal contacts
  digest/       Auto-generated notes from promoted assistant chats
```

**Rule:** All folders except `digest/` are manually maintained by Nic in Obsidian. `digest/` is written automatically by the app when a Telegram promotion is confirmed. Neither folder type is treated differently by the sync script — all `.md` files in the vault are embedded and indexed regardless of folder.

---

## File naming convention

All filenames are **slug-style**: lowercase, hyphens instead of spaces, no special characters. Safe across operating systems and readable in git diffs.

| Folder | Pattern | Example |
|---|---|---|
| `clients/` | `client-{slug}.md` | `client-greentech-plaza.md` |
| `suppliers/` | `supplier-{slug}.md` | `supplier-armstrong-ceiling.md` |
| `sops/` | `sop-{slug}.md` | `sop-suspended-ceiling-install.md` |
| `jobs/` | `job-{YYYY-MM-DD}-{slug}.md` | `job-2026-05-20-cable-tray-lesson.md` |
| `templates/` | `template-{slug}.md` | `template-ptw-standard.md` |
| `contacts/` | `contact-{slug}.md` | `contact-bca-inspector.md` |
| `digest/` | `{YYYY-MM-DD}-{slug}.md` | `2026-05-26-armstrong-pricing-update.md` |

`{slug}` is derived from the note's subject — short, descriptive, no articles (skip "the", "a", "an"). For `digest/` notes, the slug comes from `asst_chats.topic`, cleaned to slug format.

---

## Frontmatter

Every note — manual or auto-generated — must include this frontmatter block at the top:

```yaml
---
visibility: [public-internal]
tags: [sop, ceiling, suspended]
---
```

Both fields are required. The nightly sync script reads these and applies them to `kb_chunks`. Notes with no frontmatter fall back to `visibility: [public-internal]` (everyone can see it) and no tags.

### `visibility` — who can retrieve this note via the AI

| Token | Who can see it |
|---|---|
| `public-internal` | All roles — sales, scheduler, installer, admin |
| `role:sales` | Sales only |
| `role:scheduler` | Scheduler only |
| `role:installer` | Installer only |
| `role:admin` | Admin only |
| `role:sales, role:scheduler` | Sales and scheduler (most common for sensitive content) |

Multiple tokens combine with OR — a user matching any token in the list can retrieve the note.

### Visibility rules by content type

| Content type | Visibility |
|---|---|
| Install SOPs, how-tos, procedures | `[public-internal]` |
| Client name, site address, preferences | `[public-internal]` |
| Client quotes, pricing, margins | `[role:sales, role:scheduler]` |
| Supplier contact info, product specs | `[public-internal]` |
| Supplier pricing, lead times, discounts | `[role:sales, role:scheduler]` |
| Post-job lessons, what-went-wrong notes | `[public-internal]` |
| PTW, onboarding, DO templates | `[public-internal]` |
| Quote and pricing templates | `[role:sales, role:scheduler]` |
| Digest notes | Set by tagger based on content (see below) |

**Default when in doubt:** `[public-internal]`. Over-restriction is preferable to accidental exposure, but most operational knowledge is safe for the whole team.

### `tags` — content keywords

2–5 lowercase keywords describing the note's subject. Used for filtering and search context. Examples:

```yaml
tags: [supplier, pricing, armstrong, ceiling-tiles]
tags: [sop, waterproofing, external-wall]
tags: [client, profile, greentech]
tags: [lesson, cable-tray, conduit]
```

---

## Auto-write on digest promotion

When a majority vote confirms "Promote" on a Telegram digest message, the following runs automatically — no manual action required.

### Flow

```
Telegram vote → majority Promote confirmed
       ↓
Vercel digest webhook fires (/api/telegram/digest-webhook)
       ↓
Claude Sonnet generates clean prose summary of the conversation
       ↓
Sonnet classifies content → sets visibility tokens + tags + slug
       ↓
Vercel calls GitHub API → commits file to vault/digest/{YYYY-MM-DD}-{slug}.md
       ↓
Obsidian-git plugin pulls on next sync → file appears in vault
       ↓
Nightly obsidian-sync.ts embeds it → kb_chunks updated in Supabase
       ↓
AI assistant can retrieve it
```

### Auto-generated note format

```markdown
---
visibility: [role:sales, role:scheduler]
tags: [supplier, pricing, armstrong]
---

# Armstrong Ceiling Tile Pricing Update

*Promoted from assistant conversation — 2026-05-26*

{Clean prose summary generated by Claude Sonnet. Not a raw transcript.
Structured as a short note a human would write — facts, decisions, context.
Typically 100–300 words.}
```

### Model

Claude Sonnet (`claude-sonnet-4-6`) is used for both summary generation and classification. Haiku is not used here — quality matters since these become permanent knowledge base entries.

### Slug generation

The slug is derived from `asst_chats.topic` (already set by the tagger when the conversation was saved). The topic string is lowercased and spaces replaced with hyphens. Example: `"Armstrong pricing update May 2026"` → `armstrong-pricing-update-may-2026`.

---

## Manual override

Any note — including auto-generated `digest/` notes — can have its frontmatter edited manually in Obsidian at any time. The nightly sync re-reads every file each run and upserts the current frontmatter values to `kb_chunks`. There is no cache to invalidate.

**Example override:** Haiku auto-classifies a promoted chat as `public-internal`, but on review you notice it contains supplier pricing. Open the file in Obsidian, change `visibility` to `[role:sales, role:scheduler]`, save. The next nightly sync applies the corrected visibility to the index.

Manual edits take effect within 24 hours (next sync). No code change required.

---

## Adding a new role in the future

When a new role is created (e.g. `role:foreman`), two places need updating for the vault/tagger to recognise it:

### 1. [src/lib/ai/tagger.ts:36](src/lib/ai/tagger.ts#L36) — add token to the allowed list

```ts
// Before
["public-internal","role:sales","role:scheduler","role:installer"]

// After
["public-internal","role:sales","role:scheduler","role:installer","role:foreman"]
```

### 2. [src/lib/ai/tagger.ts:38-41](src/lib/ai/tagger.ts#L38-L41) — add a classification rule

```
- "role:foreman" → site supervision notes, foreman-specific briefings
```

The same update applies to the digest auto-write classification prompt (added in implementation). Existing vault notes are unaffected — their frontmatter stays valid and the new role can be applied to new notes immediately.

The broader system (DB enum, RLS policies, UI role checks) also needs updating when a new role is created, but that is handled separately as part of the role provisioning work.

---

## What this does NOT cover

- The `asst_chats` table — raw conversation memory, separate system, not in the vault
- Obsidian-git sync configuration (already set up)
- The nightly obsidian-sync.ts script (no changes required — it reads whatever frontmatter is present)
- Deletion of vault notes (out of scope — delete manually in Obsidian if needed; stale chunks are removed from `kb_chunks` automatically on next sync)
