# Obsidian Vault Convention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Obsidian vault folder structure, auto-commit promoted digest conversations as `.md` files to the vault via GitHub API, and update the digest flow to use Claude Sonnet with correct visibility frontmatter.

**Architecture:** A new `src/lib/github/vault.ts` helper handles all GitHub API writes. A new `src/lib/digest/autoPromote.ts` function orchestrates summary generation + frontmatter assembly + vault commit. The digest webhook calls `autoPromoteToVault()` directly when majority is reached; the existing `/api/digest/promote/[id]` route is repurposed to call the same function as a signed manual fallback.

**Tech Stack:** Next.js API routes, Anthropic SDK (Sonnet), GitHub Contents API, Supabase service client, vault git submodule (`Greenqubes/greenqubes-kb`)

---

## File Map

| Action | File |
|---|---|
| Create | `src/lib/github/vault.ts` |
| Create | `src/lib/digest/autoPromote.ts` |
| Modify | `src/app/api/digest/promote/[id]/route.ts` |
| Modify | `src/app/api/telegram/digest-webhook/route.ts` |
| Manual | `vault/` submodule — create 7 folders |
| Env | `.env.local` + Vercel dashboard |

---

## Task 1: Add env vars

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add vault GitHub env vars to `.env.local`**

Open `.env.local` and append:

```
# Obsidian vault — GitHub API auto-commit
GITHUB_VAULT_REPO=Greenqubes/greenqubes-kb
GITHUB_VAULT_TOKEN=
```

Leave `GITHUB_VAULT_TOKEN` blank for now — filled in Step 2.

- [ ] **Step 2: Create a GitHub fine-grained personal access token**

Go to https://github.com/settings/tokens → Fine-grained tokens → Generate new token.

Settings:
- **Resource owner:** Greenqubes
- **Repository access:** Only select repositories → `greenqubes-kb`
- **Permissions:** Contents → Read and write

Copy the token and paste it as `GITHUB_VAULT_TOKEN` in `.env.local`.

- [ ] **Step 3: Commit nothing yet — `.env.local` is gitignored**

```bash
git status
```

Confirm `.env.local` does not appear as an untracked file. If it does, check `.gitignore`.

---

## Task 2: Scaffold vault folders

**Files:**
- Modify: `vault/` submodule (committed directly to `Greenqubes/greenqubes-kb`)

> These steps run inside the vault submodule, which is a separate git repo.

- [ ] **Step 1: Navigate into the vault submodule and create folders**

```bash
cd vault
mkdir clients suppliers sops jobs templates contacts digest
```

- [ ] **Step 2: Add a `.gitkeep` placeholder to each folder**

```bash
New-Item clients/.gitkeep, suppliers/.gitkeep, sops/.gitkeep, jobs/.gitkeep, templates/.gitkeep, contacts/.gitkeep, digest/.gitkeep -ItemType File
```

- [ ] **Step 3: Commit and push to the vault repo**

```bash
git add .
git commit -m "chore: add vault folder scaffolding (clients, suppliers, sops, jobs, templates, contacts, digest)"
git push origin main
```

Expected output: `main -> main` push confirmed.

- [ ] **Step 4: Return to the main repo and update the submodule pointer**

```bash
cd ..
git add vault
git commit -m "chore: update vault submodule to include folder scaffolding"
git push origin dev
```

- [ ] **Step 5: Verify in GitHub**

Open `https://github.com/Greenqubes/greenqubes-kb` in a browser. Confirm the 7 folders appear in the repo root.

---

## Task 3: Create GitHub vault helper

**Files:**
- Create: `src/lib/github/vault.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/github/vault.ts

const VAULT_REPO  = process.env.GITHUB_VAULT_REPO!   // "Greenqubes/greenqubes-kb"
const VAULT_TOKEN = process.env.GITHUB_VAULT_TOKEN!

/**
 * Converts a topic string to a URL-safe slug.
 * e.g. "Armstrong Pricing Update May 2026" → "armstrong-pricing-update-may-2026"
 */
export function topicToSlug(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

/**
 * Commits a new file to the vault GitHub repo via the Contents API.
 * filePath is relative to the vault root — e.g. "digest/2026-05-26-topic.md"
 * Throws if the GitHub API returns an error.
 */
export async function commitVaultFile(
  filePath: string,
  content: string,
  commitMessage: string,
): Promise<void> {
  if (!VAULT_REPO || !VAULT_TOKEN) {
    throw new Error('GITHUB_VAULT_REPO or GITHUB_VAULT_TOKEN not set')
  }

  const url = `https://api.github.com/repos/${VAULT_REPO}/contents/${filePath}`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization':        `Bearer ${VAULT_TOKEN}`,
      'Content-Type':         'application/json',
      'Accept':               'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      message: commitMessage,
      content: Buffer.from(content, 'utf-8').toString('base64'),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(`GitHub API ${res.status}: ${JSON.stringify(err)}`)
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors for the new file.

---

## Task 4: Create the auto-promote helper

**Files:**
- Create: `src/lib/digest/autoPromote.ts`

This module owns the full promotion flow: fetch chat → summarise → assemble frontmatter → commit to vault.

- [ ] **Step 1: Create the file**

```typescript
// src/lib/digest/autoPromote.ts

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import { commitVaultFile, topicToSlug } from '@/lib/github/vault'
import type { Json } from '@/lib/supabase/types'

const anthropic = new Anthropic()

type ChatMsg = { role: string; content: string }

function parseMsgs(msgs: Json): ChatMsg[] {
  if (!Array.isArray(msgs)) return []
  return msgs.filter((m): m is ChatMsg =>
    typeof m === 'object' && m !== null &&
    typeof (m as Record<string, unknown>).role === 'string' &&
    typeof (m as Record<string, unknown>).content === 'string',
  )
}

async function generateSummary(msgs: Json, topic: string | null): Promise<string> {
  const conversation = parseMsgs(msgs)
    .map(m => `${(m as ChatMsg).role}: ${(m as ChatMsg).content}`)
    .join('\n')
    .slice(0, 6000)

  if (!conversation.trim()) return topic ?? '[No content]'

  const res = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{
      role:    'user',
      content: `Write a concise knowledge-base note (100–300 words) from this AI assistant conversation.
Focus on useful learnings, decisions, or information discussed.
Write in third person ("The team discussed…").
Structure as flowing prose — no bullet lists. No preamble.

${conversation}`,
    }],
  })

  return res.content[0].type === 'text' ? res.content[0].text : '[Summary unavailable]'
}

/**
 * Promotes an asst_chats conversation to the Obsidian vault.
 * Generates a Sonnet summary, assembles frontmatter from stored visibility/tags,
 * and commits a .md file to vault/digest/ via GitHub API.
 *
 * Returns the vault file path on success, throws on failure.
 */
export async function autoPromoteToVault(chatId: string): Promise<{ path: string }> {
  const db = createServiceClient()

  const { data: chat, error } = await db
    .from('asst_chats')
    .select('id, msgs, topic, tags, visibility, ts')
    .eq('id', chatId)
    .single()

  if (error || !chat) throw new Error(`Chat ${chatId} not found`)

  const summary    = await generateSummary(chat.msgs, chat.topic)
  const date       = new Date(chat.ts).toISOString().split('T')[0]
  const topic      = chat.topic ?? 'Untitled conversation'
  const slug       = topicToSlug(topic)
  const tags       = Array.isArray(chat.tags) && chat.tags.length
                       ? (chat.tags as string[]).join(', ')
                       : 'assistant, digest'
  const visibility = Array.isArray(chat.visibility) && chat.visibility.length
                       ? (chat.visibility as string[]).join(', ')
                       : 'public-internal'

  const noteContent = `---
visibility: [${visibility}]
tags: [${tags}]
source: ai-assistant
date: ${date}
---

# ${topic}

*Promoted from assistant conversation — ${date}*

${summary}
`

  const filePath = `digest/${date}-${slug}.md`
  await commitVaultFile(filePath, noteContent, `digest: promote "${topic}" (${date})`)

  return { path: filePath }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Task 5: Update the promote route

**Files:**
- Modify: `src/app/api/digest/promote/[id]/route.ts`

Replace the copy-paste HTML flow with a call to `autoPromoteToVault`. Keep signature verification as a security gate so this URL remains a valid signed manual fallback.

- [ ] **Step 1: Replace the entire file contents**

```typescript
// src/app/api/digest/promote/[id]/route.ts

import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { autoPromoteToVault } from '@/lib/digest/autoPromote'

function verifySignature(chatId: string, sig: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.CRON_SECRET!)
    .update(chatId)
    .digest('hex')
    .slice(0, 16)
  return expected === sig
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sig = req.nextUrl.searchParams.get('sig') ?? ''

  if (!sig || !verifySignature(id, sig)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const { path } = await autoPromoteToVault(id)
    return NextResponse.json({ ok: true, path })
  } catch (err) {
    console.error('[promote] vault commit failed:', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Task 6: Update the digest webhook

**Files:**
- Modify: `src/app/api/telegram/digest-webhook/route.ts`

When a promotion is confirmed, call `autoPromoteToVault` directly (no HTTP self-call). Update the Telegram message to reflect auto-commit rather than "tap to get note".

- [ ] **Step 1: Add the import at the top of the file**

After the existing imports, add:

```typescript
import { autoPromoteToVault } from '@/lib/digest/autoPromote'
```

- [ ] **Step 2: Replace the entire `if (promoted)` block in `handleDigestVote`**

Find this block (around line 134):

```typescript
  if (promoted) {
    const promoteUrl = buildPromoteUrl(chatId)
    const { data: schedulers } = await db
      .from('users')
      .select('telegram_chat_id')
      .eq('digest_subscriber', true)
      .not('telegram_chat_id', 'is', null)

    for (const s of schedulers ?? []) {
      if (s.telegram_chat_id) {
        await sendDigestTelegram(
          s.telegram_chat_id,
          `📝 <b>${chat.topic ?? 'Conversation'}</b> reached majority — tap to get your Obsidian note:\n${promoteUrl}`,
        )
      }
    }
  }
```

Replace it with:

```typescript
  if (promoted) {
    // Auto-commit to vault in the background — don't block the webhook response
    autoPromoteToVault(chatId).then(({ path }) => {
      console.log(`[digest webhook] vault note committed: ${path}`)
    }).catch(err => {
      console.error('[digest webhook] auto-promote failed:', (err as Error).message)
    })

    const { data: subscribers } = await db
      .from('users')
      .select('telegram_chat_id')
      .eq('digest_subscriber', true)
      .not('telegram_chat_id', 'is', null)

    for (const s of subscribers ?? []) {
      if (s.telegram_chat_id) {
        await sendDigestTelegram(
          s.telegram_chat_id,
          `✅ <b>${chat.topic ?? 'Conversation'}</b> reached majority — note is being written to Obsidian vault automatically.`,
        )
      }
    }
  }
```

- [ ] **Step 3: Remove the now-unused `buildPromoteUrl` function**

Delete this function from the bottom of the file:

```typescript
function buildPromoteUrl(chatId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${process.env.VERCEL_URL ?? 'localhost:3001'}`
  const sig = crypto
    .createHmac('sha256', process.env.CRON_SECRET!)
    .update(chatId)
    .digest('hex')
    .slice(0, 16)
  return `${appUrl}/api/digest/promote/${chatId}?sig=${sig}`
}
```

Also remove `import crypto from 'node:crypto'` from the top of this file if it's no longer used after removing `buildPromoteUrl`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/github/vault.ts src/lib/digest/autoPromote.ts src/app/api/digest/promote/[id]/route.ts src/app/api/telegram/digest-webhook/route.ts
git commit -m "feat: auto-commit promoted digest chats to Obsidian vault via GitHub API"
```

---

## Task 7: Add env vars to Vercel

These are manual steps in the Vercel dashboard — the app won't auto-commit without them.

- [ ] **Step 1: Open Vercel project settings**

Go to https://vercel.com → greenqubes-ops project → Settings → Environment Variables.

- [ ] **Step 2: Add both variables to all three environments (Production, Preview, Development)**

| Key | Value |
|---|---|
| `GITHUB_VAULT_REPO` | `Greenqubes/greenqubes-kb` |
| `GITHUB_VAULT_TOKEN` | _(the fine-grained PAT from Task 1 Step 2)_ |

- [ ] **Step 3: Redeploy**

Trigger a redeploy so the new env vars take effect on the Preview URL.

---

## Task 8: End-to-end verification

- [ ] **Step 1: Confirm folders exist in vault on GitHub**

Open https://github.com/Greenqubes/greenqubes-kb and verify: `clients/`, `suppliers/`, `sops/`, `jobs/`, `templates/`, `contacts/`, `digest/` all appear.

- [ ] **Step 2: Test auto-commit manually via the promote route**

Find a real `asst_chats` row ID in Supabase (any conversation). Generate a valid signature:

```bash
node -e "
const crypto = require('crypto');
const id = '<your-chat-id>';
const sig = crypto.createHmac('sha256', '<CRON_SECRET>').update(id).digest('hex').slice(0, 16);
console.log('sig:', sig);
"
```

Then call:

```
GET https://greenqubes-ops.vercel.app/api/digest/promote/<id>?sig=<sig>
```

Expected response: `{ "ok": true, "path": "digest/2026-05-26-<slug>.md" }`

- [ ] **Step 3: Verify file appeared in GitHub**

Open https://github.com/Greenqubes/greenqubes-kb/tree/main/digest — the new file should appear within seconds.

- [ ] **Step 4: Verify obsidian-git pulls it**

On your local PC, open Obsidian → obsidian-git plugin → Pull. The new file should appear in `vault/digest/`.

- [ ] **Step 5: Verify frontmatter**

Open the new file in Obsidian. Check:
- `visibility` matches what the original conversation's tags suggest (not hardcoded `public-internal`)
- `tags` match the original chat's tags
- `source: ai-assistant` and `date` are present
- Body is a clean prose summary (not a raw transcript)

- [ ] **Step 6: Push to dev and confirm Vercel preview build passes**

```bash
git push origin dev
```

Check Vercel dashboard for a green build.
