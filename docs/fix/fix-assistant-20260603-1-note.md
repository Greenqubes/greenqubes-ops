# Session Note — fix-assistant — 2026-06-03

**Session type:** Fix — RAG Pipeline + Knowledge Base + Table Rendering
**Status:** Complete

---

## What was done

### RAG retrieval not working for supplier pricing

The assistant could not answer questions about supplier pricing despite the data being in the Obsidian vault. Three separate issues were found and fixed.

**Issue 1: Voyage AI missing `input_type`**
The `embed()` function was calling Voyage AI without specifying `input_type`. Voyage's `voyage-3` model performs significantly better when it knows whether it's embedding a search query (`"query"`) or a document being stored (`"document"`). Without this, retrieval quality degrades — especially for tabular/numeric content like price lists.

Fix: added `inputType: 'query' | 'document'` parameter to `embed()` in `src/lib/ai/embed.ts`. Sync script now passes `"document"`; retrieval now passes `"query"`.

**Issue 2: Filename not included in chunk embeddings**
Supplier files are named `DAMA.md`, `Jacky Printing Pricelist.md` etc. but the filename was not part of the text being embedded — only the body content was. When a user asks "what's my DAMA price", the word "DAMA" doesn't appear in the table rows, so similarity scores were very low.

Fix: `scripts/obsidian-sync.ts` now prepends `File: {sourcePath}\n\n` to each chunk before embedding. Supplier files are now findable by name.

**Issue 3: Match threshold too high for tabular data**
The `match_threshold` for `kb_chunks` was 0.5. Price tables (mostly numbers, sizes, product codes) embed with lower similarity scores than prose. After testing, 0.35 was the right balance — accurate enough to avoid false positives, low enough to surface numeric price lists.

Fix: `src/lib/ai/retrieve.ts` threshold changed from 0.5 → 0.35.

All vault files re-synced after fixes. Both DAMA and Jacky Printing confirmed working in dev assistant.

---

### Table rendering in assistant chat

The `MarkdownMessage` component had no table support. Markdown tables from the assistant (e.g. pricing breakdowns) rendered as raw `| cell | cell |` text.

Fix: added table detection and rendering to `src/components/MarkdownMessage.tsx`. Tables now render with headers, 1px borders, and alternating row shading (paper / warm bone). No new npm dependencies.

---

### Supplier pricing added to vault

Created `vault/suppliers/supplier-template.md` as a reusable template with correct YAML frontmatter structure.

Added two supplier pricelists:
- `vault/suppliers/DAMA.md` — acrylic sheet pricing (clear, lighting white, coloured) across 14 thicknesses
- `vault/suppliers/Jacky Printing Pricelist.md` — print media pricing (solvent, UV, fabric, banner, etc.)

Both files synced to Supabase `kb_chunks` and confirmed retrievable by the assistant.

---

### Obsidian sync workflow clarified

Documented for Nic: vault changes made in Obsidian on the workstation are auto-committed and pushed by the Obsidian Git plugin. After that, running `npm run obsidian-sync` from the workstation pushes the content into Supabase immediately — no server PC required for manual syncs. Server PC only handles the nightly 2:30 AM automatic run.

---

## Key files changed

- `src/lib/ai/embed.ts` — `input_type` parameter added
- `src/lib/ai/retrieve.ts` — `input_type: 'query'` on retrieval query; threshold 0.35
- `scripts/obsidian-sync.ts` — filename prepended to chunk text before embedding
- `src/components/MarkdownMessage.tsx` — table rendering added
- `vault/suppliers/supplier-template.md` — new
- `vault/suppliers/DAMA.md` — new
- `vault/suppliers/Jacky Printing Pricelist.md` — new

---

## Next

- Pre-alpha testing (Session 19)
- Scheduler tab: "Send Back" + "Delete Job" on scheduled jobs
- Schedule page visual overhaul (Nic to share target screenshot)
- R2 human-readable folder names (design + plan needed before go-live)
