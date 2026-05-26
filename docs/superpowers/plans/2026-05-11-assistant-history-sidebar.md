# Assistant History Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent conversation history sidebar to `/assistant` — last 30 chats grouped by date, with pinning (max 5) and hard delete, plus a full-screen mobile history route.

**Architecture:** `HistorySidebar` (desktop, always-visible, ~260px) fetches and owns the chat list, notifying `AssistantShell` via callbacks when a chat is loaded or deleted. The sidebar handles optimistic pin/delete state internally. Mobile replaces the sidebar with a History button in the header that navigates to `/assistant/history` (a full-screen list route); tapping a chat there navigates to `/assistant?chat=<id>`, which `AssistantShell` reads via `useSearchParams()` to fetch and load that conversation. A new `pinned boolean` column on `asst_chats` (migration 0015) persists pin state.

**Tech Stack:** Next.js 15 App Router, Supabase (server + service clients), Tailwind CSS, lucide-react, existing design tokens (`--bg`, `--paper`, `--ink`, `--line`, `--terracotta`).

**Note on testing:** This project has no test framework. Each task ends with `npx tsc --noEmit` to catch type errors, followed by a manual browser verification step.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `supabase/migrations/0015_asst_chats_pinned.sql` | Add `pinned boolean` column + index |
| Modify | `src/lib/supabase/queries/assistant.ts` | Add `pinned` to type, update ORDER BY, add `pinChat()` + `deleteChat()` |
| Create | `src/app/api/assistant/history/route.ts` | GET — fetch last 30 chats for current user |
| Create | `src/app/api/assistant/pin/route.ts` | PATCH — toggle pinned state, enforce 5-pin cap |
| Create | `src/app/api/assistant/delete/route.ts` | DELETE — hard delete a chat by id |
| Create | `src/features/assistant/HistoryList.tsx` | Shared list: grouped rows, hover/⋮ menus, delete confirm |
| Create | `src/features/assistant/HistorySidebar.tsx` | Desktop sidebar: fetches history, owns state, renders HistoryList |
| Create | `src/app/assistant/history/page.tsx` | Mobile full-screen history route (server, auth) |
| Create | `src/app/assistant/history/MobileHistoryShell.tsx` | Mobile history client shell (fetch, pin, delete, navigate) |
| Modify | `src/features/assistant/AssistantShell.tsx` | Sidebar layout, `loadFromHistory`, History button, `?chat=<id>` param |

---

## Task 1: Migration 0015 — add `pinned` column

**Files:**
- Create: `supabase/migrations/0015_asst_chats_pinned.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/0015_asst_chats_pinned.sql
ALTER TABLE asst_chats
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS asst_chats_pinned_ts_idx
  ON asst_chats (user_id, pinned DESC, ts DESC);
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected output: migration applied with no errors. Column `pinned` now exists on `asst_chats`.

- [ ] **Step 3: Verify in Supabase dashboard**

Open the Supabase Table Editor → `asst_chats` → confirm `pinned` column exists with default `false`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0015_asst_chats_pinned.sql
git commit -m "feat: migration 0015 — add pinned column to asst_chats"
```

---

## Task 2: Update `queries/assistant.ts`

**Files:**
- Modify: `src/lib/supabase/queries/assistant.ts`

- [ ] **Step 1: Add `pinned` to `AsstChatRow`, update `getRecentChats`, add `pinChat` and `deleteChat`**

Replace the entire file content:

```ts
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { embed } from '@/lib/ai/embed'
import type { ChatTag } from '@/lib/ai/tagger'
import type { Json } from '@/lib/supabase/types'

export interface AsstChatRow {
  id:         string
  topic:      string | null
  msgs:       Json
  tags:       string[] | null
  importance: number | null
  pinned:     boolean
  ts:         string
}

export async function getRecentChats(limit = 20): Promise<AsstChatRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('asst_chats')
    .select('id, topic, msgs, tags, importance, pinned, ts')
    .order('pinned', { ascending: false })
    .order('ts',     { ascending: false })
    .limit(limit)
  return (data ?? []) as AsstChatRow[]
}

export async function pinChat(id: string, pinned: boolean): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('asst_chats')
    .update({ pinned })
    .eq('id', id)
}

export async function deleteChat(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('asst_chats')
    .delete()
    .eq('id', id)
}

export async function saveChat(
  userId:  string,
  msgs:    { role: string; content: string }[],
  tag:     ChatTag,
): Promise<string | null> {
  const supabase = createServiceClient()

  let embeddingStr: string | null = null
  try {
    const text    = msgs.map(m => m.content).join(' ').slice(0, 2000)
    const vec     = await embed(text)
    embeddingStr  = `[${vec.join(',')}]`
  } catch {
    // embedding is optional — save without it
  }

  const { data, error } = await supabase
    .from('asst_chats')
    .insert({
      user_id:    userId,
      msgs:       msgs as unknown as Json,
      embedding:  embeddingStr,
      topic:      tag.topic,
      entities:   tag.entities,
      tags:       tag.tags,
      importance: tag.importance,
      visibility: tag.visibility,
    })
    .select('id')
    .single()

  if (error) { console.error('saveChat error', error); return null }
  return data?.id ?? null
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/queries/assistant.ts
git commit -m "feat: add pinned to AsstChatRow, pinChat, deleteChat queries"
```

---

## Task 3: API routes — history, pin, delete

**Files:**
- Create: `src/app/api/assistant/history/route.ts`
- Create: `src/app/api/assistant/pin/route.ts`
- Create: `src/app/api/assistant/delete/route.ts`

- [ ] **Step 1: Create `history` GET route**

```ts
// src/app/api/assistant/history/route.ts
import { createClient } from '@/lib/supabase/server'
import { getRecentChats } from '@/lib/supabase/queries/assistant'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const chats = await getRecentChats(30)
  return Response.json(chats)
}
```

- [ ] **Step 2: Create `pin` PATCH route**

```ts
// src/app/api/assistant/pin/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pinChat } from '@/lib/supabase/queries/assistant'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id, pinned } = await req.json() as { id: string; pinned: boolean }
  if (!id || typeof pinned !== 'boolean') {
    return new Response('Bad request', { status: 400 })
  }

  // Enforce 5-pin cap when pinning
  if (pinned) {
    const { count } = await supabase
      .from('asst_chats')
      .select('id', { count: 'exact', head: true })
      .eq('pinned', true)
    if ((count ?? 0) >= 5) {
      return Response.json({ ok: false, reason: 'pin_cap' }, { status: 422 })
    }
  }

  await pinChat(id, pinned)
  return Response.json({ ok: true })
}
```

- [ ] **Step 3: Create `delete` DELETE route**

```ts
// src/app/api/assistant/delete/route.ts
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteChat } from '@/lib/supabase/queries/assistant'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await req.json() as { id: string }
  if (!id) return new Response('Bad request', { status: 400 })

  await deleteChat(id)
  return Response.json({ ok: true })
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/assistant/history/route.ts src/app/api/assistant/pin/route.ts src/app/api/assistant/delete/route.ts
git commit -m "feat: assistant history, pin, and delete API routes"
```

---

## Task 4: `HistoryList.tsx` — shared grouped list component

**Files:**
- Create: `src/features/assistant/HistoryList.tsx`

This component is used by both `HistorySidebar` (desktop) and the mobile history page. It handles grouping, hover menus, ⋮ dropdowns, and delete confirmation. Date group labels are always English per spec.

- [ ] **Step 1: Create the file**

```tsx
// src/features/assistant/HistoryList.tsx
'use client'

import { useState } from 'react'
import { Pin, MoreVertical, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'
import type { Json } from '@/lib/supabase/types'

interface Props {
  chats:         AsstChatRow[]
  activeChatId?: string
  onLoad:        (chat: AsstChatRow) => void
  onPin:         (id: string, pinned: boolean) => void
  onDelete:      (id: string) => void
  mobile?:       boolean
}

type Group = 'pinned' | 'today' | 'week' | 'earlier'

function getGroup(chat: AsstChatRow): Group {
  if (chat.pinned) return 'pinned'
  const now  = new Date()
  const date = new Date(chat.ts)
  const diffMs   = now.getTime() - date.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  const sameDay  = now.toDateString() === date.toDateString()
  if (sameDay)      return 'today'
  if (diffDays < 7) return 'week'
  return 'earlier'
}

function msgCount(msgs: Json): number {
  if (!Array.isArray(msgs)) return 0
  return msgs.length
}

function stars(importance: number | null): string {
  const n = Math.min(5, Math.max(0, importance ?? 0))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

const GROUP_LABELS: Record<Group, string> = {
  pinned:  'Pinned',
  today:   'Today',
  week:    'This Week',
  earlier: 'Earlier',
}

const GROUP_ORDER: Group[] = ['pinned', 'today', 'week', 'earlier']

export function HistoryList({ chats, activeChatId, onLoad, onPin, onDelete, mobile }: Props) {
  const [openMenuId,       setOpenMenuId]       = useState<string | null>(null)
  const [confirmDeleteId,  setConfirmDeleteId]  = useState<string | null>(null)

  const grouped = GROUP_ORDER.reduce<Record<Group, AsstChatRow[]>>(
    (acc, g) => ({ ...acc, [g]: [] }),
    { pinned: [], today: [], week: [], earlier: [] },
  )
  for (const chat of chats) grouped[getGroup(chat)].push(chat)

  function handlePin(chat: AsstChatRow) {
    setOpenMenuId(null)
    onPin(chat.id, !chat.pinned)
  }

  function handleDeleteClick(id: string) {
    setOpenMenuId(null)
    setConfirmDeleteId(id)
  }

  function handleDeleteConfirm(id: string) {
    setConfirmDeleteId(null)
    onDelete(id)
  }

  return (
    <div className="flex flex-col gap-1">
      {GROUP_ORDER.map(group => {
        const items = grouped[group]
        if (items.length === 0) return null
        return (
          <div key={group} className="mb-2">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
              {GROUP_LABELS[group]}
            </p>
            {items.map(chat => (
              <ChatRow
                key={chat.id}
                chat={chat}
                isActive={chat.id === activeChatId}
                isMenuOpen={openMenuId === chat.id}
                isConfirmingDelete={confirmDeleteId === chat.id}
                mobile={mobile}
                onLoad={() => onLoad(chat)}
                onToggleMenu={() => setOpenMenuId(openMenuId === chat.id ? null : chat.id)}
                onPin={() => handlePin(chat)}
                onDeleteClick={() => handleDeleteClick(chat.id)}
                onDeleteConfirm={() => handleDeleteConfirm(chat.id)}
                onDeleteCancel={() => setConfirmDeleteId(null)}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── ChatRow ──────────────────────────────────────────────────────────────────

interface RowProps {
  chat:                AsstChatRow
  isActive:            boolean
  isMenuOpen:          boolean
  isConfirmingDelete:  boolean
  mobile?:             boolean
  onLoad:              () => void
  onToggleMenu:        () => void
  onPin:               () => void
  onDeleteClick:       () => void
  onDeleteConfirm:     () => void
  onDeleteCancel:      () => void
}

function ChatRow({
  chat, isActive, isMenuOpen, isConfirmingDelete, mobile,
  onLoad, onToggleMenu, onPin, onDeleteClick, onDeleteConfirm, onDeleteCancel,
}: RowProps) {
  const topic = chat.topic ?? 'Untitled conversation'
  const count = msgCount(chat.msgs)

  if (isConfirmingDelete) {
    return (
      <div className="mx-1 mb-1 rounded-lg border border-line bg-paper px-3 py-2">
        <p className="text-xs font-medium text-ink mb-2">Delete permanently?</p>
        <div className="flex gap-2">
          <button
            onClick={onDeleteConfirm}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-terracotta text-white text-xs font-medium hover:bg-terracotta/90 transition-colors"
          >
            <Check size={11} /> Confirm
          </button>
          <button
            onClick={onDeleteCancel}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-line text-ink2 text-xs font-medium hover:border-ink2 transition-colors"
          >
            <X size={11} /> Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative group">
      <button
        onClick={onLoad}
        className={cn(
          'w-full text-left px-3 py-2 rounded-lg transition-colors flex flex-col gap-0.5',
          isActive ? 'bg-terracotta/10 border border-terracotta/20' : 'hover:bg-bg',
        )}
      >
        <div className="flex items-start justify-between gap-1 pr-10">
          <span className="text-sm font-medium text-ink truncate leading-tight">
            {chat.pinned && <span className="mr-1 text-amber text-[11px]">📌</span>}
            {topic}
          </span>
        </div>
        <span className="text-[11px] text-muted">
          {count} {count === 1 ? 'message' : 'messages'}
          {chat.importance ? <span className="ml-1.5 text-amber">{stars(chat.importance)}</span> : null}
        </span>
      </button>

      {/* Desktop hover actions — hidden on mobile */}
      {!mobile && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onPin() }}
            title={chat.pinned ? 'Unpin' : 'Pin'}
            className={cn(
              'p-1 rounded-md hover:bg-line transition-colors',
              chat.pinned ? 'text-amber' : 'text-muted hover:text-ink',
            )}
          >
            <Pin size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onToggleMenu() }}
            className="p-1 rounded-md text-muted hover:text-ink hover:bg-line transition-colors"
          >
            <MoreVertical size={13} />
          </button>
        </div>
      )}

      {/* Mobile ⋮ — always visible */}
      {mobile && (
        <button
          onClick={e => { e.stopPropagation(); onToggleMenu() }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted hover:text-ink hover:bg-line transition-colors"
        >
          <MoreVertical size={14} />
        </button>
      )}

      {/* ⋮ dropdown */}
      {isMenuOpen && (
        <div className="absolute right-2 top-full mt-1 z-20 min-w-[160px] bg-paper border border-line rounded-xl shadow-md py-1">
          {mobile && (
            <button
              onClick={e => { e.stopPropagation(); onPin() }}
              className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-bg transition-colors flex items-center gap-2"
            >
              <Pin size={13} className={chat.pinned ? 'text-amber' : 'text-muted'} />
              {chat.pinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDeleteClick() }}
            className="w-full text-left px-3 py-2 text-sm text-terracotta hover:bg-bg transition-colors"
          >
            Delete conversation
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/assistant/HistoryList.tsx
git commit -m "feat: HistoryList component — grouped chat rows with pin/delete interactions"
```

---

## Task 5: `HistorySidebar.tsx` — desktop sidebar

**Files:**
- Create: `src/features/assistant/HistorySidebar.tsx`

Fetches history on mount, owns `chats` state, handles optimistic pin/delete, shows toast on pin cap, renders `HistoryList`. Hidden on mobile via `hidden md:flex`.

- [ ] **Step 1: Create the file**

```tsx
// src/features/assistant/HistorySidebar.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { PlusCircle, Loader2 } from 'lucide-react'
import { HistoryList } from './HistoryList'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'

interface Props {
  activeChatId?: string
  onLoad:        (chat: AsstChatRow) => void
  onNewChat:     () => void
  onDelete:      (id: string) => void
}

export function HistorySidebar({ activeChatId, onLoad, onNewChat, onDelete }: Props) {
  const [chats,   setChats]   = useState<AsstChatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState<string | null>(null)

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant/history')
      if (res.ok) setChats(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchChats() }, [fetchChats])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handlePin(id: string, pinned: boolean) {
    // Optimistic update
    setChats(prev => prev.map(c => c.id === id ? { ...c, pinned } : c))

    const res = await fetch('/api/assistant/pin', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, pinned }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      // Revert
      setChats(prev => prev.map(c => c.id === id ? { ...c, pinned: !pinned } : c))
      if (body?.reason === 'pin_cap') {
        showToast('You can pin up to 5 conversations')
      }
    }
  }

  async function handleDelete(id: string) {
    // Optimistic update
    setChats(prev => prev.filter(c => c.id !== id))
    onDelete(id)

    const res = await fetch('/api/assistant/delete', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })

    if (!res.ok) {
      // Refetch to restore state
      fetchChats()
    }
  }

  return (
    <aside className="hidden md:flex flex-col shrink-0 w-[260px] border-r border-line bg-paper h-screen sticky top-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">History</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-muted" />
          </div>
        ) : chats.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted text-center">No conversations yet</p>
        ) : (
          <HistoryList
            chats={chats}
            activeChatId={activeChatId}
            onLoad={onLoad}
            onPin={handlePin}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-16 left-2 right-2 px-3 py-2 bg-ink text-white text-xs rounded-lg shadow-md text-center">
          {toast}
        </div>
      )}

      {/* New Chat button */}
      <div className="shrink-0 p-3 border-t border-line">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-line bg-bg text-ink2 hover:border-ink2 hover:text-ink text-sm font-medium transition-colors"
        >
          <PlusCircle size={14} />
          New chat
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/assistant/HistorySidebar.tsx
git commit -m "feat: HistorySidebar component — desktop persistent history sidebar"
```

---

## Task 6: Mobile history page

**Files:**
- Create: `src/app/assistant/history/page.tsx`

Server component for auth/redirect, inline client shell for fetching + rendering history. Tapping a row navigates to `/assistant?chat=<id>`.

- [ ] **Step 1: Create the file**

```tsx
// src/app/assistant/history/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MobileHistoryShell } from './MobileHistoryShell'
import type { LangCode } from '@/lib/supabase/types'

export default async function AssistantHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type Profile = { lang: string }
  const { data: profile } = await supabase
    .from('users')
    .select('lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }

  if (!profile) redirect('/login')

  return <MobileHistoryShell lang={profile.lang as LangCode} />
}
```

- [ ] **Step 2: Create `MobileHistoryShell` in the same folder**

```tsx
// src/app/assistant/history/MobileHistoryShell.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { HistoryList } from '@/features/assistant/HistoryList'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'
import type { LangCode } from '@/lib/supabase/types'

interface Props { lang: LangCode }

export function MobileHistoryShell({ lang: _lang }: Props) {
  const router = useRouter()
  const [chats,   setChats]   = useState<AsstChatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState<string | null>(null)

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant/history')
      if (res.ok) setChats(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchChats() }, [fetchChats])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handlePin(id: string, pinned: boolean) {
    setChats(prev => prev.map(c => c.id === id ? { ...c, pinned } : c))
    const res = await fetch('/api/assistant/pin', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, pinned }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setChats(prev => prev.map(c => c.id === id ? { ...c, pinned: !pinned } : c))
      if (body?.reason === 'pin_cap') showToast('You can pin up to 5 conversations')
    }
  }

  async function handleDelete(id: string) {
    setChats(prev => prev.filter(c => c.id !== id))
    const res = await fetch('/api/assistant/delete', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })
    if (!res.ok) fetchChats()
  }

  function handleLoad(chat: AsstChatRow) {
    router.push(`/assistant?chat=${chat.id}`)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-line bg-paper px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-display text-[15px] font-medium text-ink">History</h1>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-muted" />
          </div>
        ) : chats.length === 0 ? (
          <p className="text-center text-sm text-muted py-12">No conversations yet</p>
        ) : (
          <HistoryList
            chats={chats}
            onLoad={handleLoad}
            onPin={handlePin}
            onDelete={handleDelete}
            mobile
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 px-4 py-2.5 bg-ink text-white text-sm rounded-xl shadow-md text-center">
          {toast}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/assistant/history/page.tsx src/app/assistant/history/MobileHistoryShell.tsx
git commit -m "feat: mobile assistant history route /assistant/history"
```

---

## Task 7: Update `AssistantShell.tsx`

**Files:**
- Modify: `src/features/assistant/AssistantShell.tsx`

Changes:
1. Add `HistorySidebar` beside the main content (desktop only — sidebar handles its own `hidden md:flex`)
2. Add `activeChatId` state
3. Add `loadFromHistory(chat)` — saves current if ≥2 msgs, loads from chat.msgs, sets activeChatId
4. Update `startNewChat` to reset `activeChatId`
5. Add History button (`History` icon) to mobile header → links to `/assistant/history`
6. Add `useSearchParams()` to detect `?chat=<id>` and auto-load on mount
7. Pass `onDelete` to sidebar so AssistantShell can reset if the active chat is deleted

- [ ] **Step 1: Replace `AssistantShell.tsx` with the updated version**

```tsx
// src/features/assistant/AssistantShell.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Send, RotateCcw, Bot, User, Loader2,
  ExternalLink, Sparkles, History,
} from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'
import { HistorySidebar } from './HistorySidebar'
import type { AsstChatRow } from '@/lib/supabase/queries/assistant'

interface Message {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  sources?:  { url: string; title: string }[]
  streaming?: boolean
  error?:    boolean
}

interface Props {
  userName: string
  role:     Role
  lang:     LangCode
  backHref: string
}

function uid() {
  return Math.random().toString(36).slice(2)
}

export function AssistantShell({ lang, backHref, role }: Props) {
  const [messages,      setMessages]      = useState<Message[]>([])
  const [input,         setInput]         = useState('')
  const [isStreaming,   setIsStreaming]   = useState(false)
  const [activeChatId,  setActiveChatId]  = useState<string | undefined>()
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const messagesRef  = useRef<Message[]>([])
  const searchParams = useSearchParams()
  const chatIdParam  = searchParams.get('chat')

  // Pick up any conversation started in the floating chat panel
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('floating_chat_handoff')
      if (stored) {
        const msgs = JSON.parse(stored) as Message[]
        if (msgs.length > 0) setMessages(msgs)
        sessionStorage.removeItem('floating_chat_handoff')
      }
    } catch { /* ignore parse errors */ }
  }, [])

  // Auto-load chat from ?chat=<id> (mobile history navigation)
  useEffect(() => {
    if (!chatIdParam) return
    fetch('/api/assistant/history')
      .then(r => r.json())
      .then((chats: AsstChatRow[]) => {
        const found = chats.find(c => c.id === chatIdParam)
        if (found) loadFromHistory(found)
      })
      .catch(() => { /* best-effort */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIdParam])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const saveConversation = useCallback(async (msgs: Message[]) => {
    const payload = msgs
      .filter(m => !m.streaming && !m.error)
      .map(m => ({ role: m.role, content: m.content }))
    if (payload.length < 2) return
    try {
      await fetch('/api/assistant/save', {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        keepalive: true,
        body:      JSON.stringify({ messages: payload }),
      })
    } catch {
      // best-effort; don't surface to user
    }
  }, [])

  useEffect(() => { messagesRef.current = messages }, [messages])

  // Save on unmount (user navigates away without clicking New Chat)
  useEffect(() => {
    return () => { saveConversation(messagesRef.current) }
  }, [saveConversation])

  function loadFromHistory(chat: AsstChatRow) {
    if (messages.length >= 2) saveConversation(messages)
    const msgs = (chat.msgs as { role: 'user' | 'assistant'; content: string }[])
      .map(m => ({ id: uid(), role: m.role, content: m.content }))
    setMessages(msgs)
    setActiveChatId(chat.id)
    setInput('')
  }

  function startNewChat() {
    if (messages.length >= 2) saveConversation(messages)
    setMessages([])
    setInput('')
    setActiveChatId(undefined)
    inputRef.current?.focus()
  }

  function handleSidebarDelete(id: string) {
    if (id === activeChatId) {
      setMessages([])
      setActiveChatId(undefined)
    }
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: Message = { id: uid(), role: 'user', content: text }
    const asstId = uid()
    const asstMsg: Message = { id: asstId, role: 'assistant', content: '', streaming: true }

    const next = [...messages, userMsg, asstMsg]
    setMessages(next)
    setInput('')
    setIsStreaming(true)

    const history = next
      .filter(m => !m.streaming)
      .slice(0, -1)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    try {
      const res = await fetch('/api/assistant/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: [...history, { role: 'user', content: text }],
        }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''
      let   finalContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const raw = part.slice(6).trim()
          if (!raw) continue

          let payload: { type: string; text?: string; sources?: { url: string; title: string }[]; message?: string }
          try { payload = JSON.parse(raw) } catch { continue }

          if (payload.type === 'text' && payload.text) {
            finalContent += payload.text
            setMessages(prev =>
              prev.map(m =>
                m.id === asstId ? { ...m, content: finalContent } : m,
              ),
            )
          } else if (payload.type === 'sources' && payload.sources) {
            setMessages(prev =>
              prev.map(m =>
                m.id === asstId ? { ...m, sources: payload.sources } : m,
              ),
            )
          } else if (payload.type === 'error') {
            setMessages(prev =>
              prev.map(m =>
                m.id === asstId
                  ? { ...m, content: payload.message ?? t(lang, 'assistantError'), streaming: false, error: true }
                  : m,
              ),
            )
          }
        }
      }

      setMessages(prev => prev.map(m => m.id === asstId ? { ...m, streaming: false } : m))
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === asstId
            ? { ...m, content: t(lang, 'assistantError'), streaming: false, error: true }
            : m,
        ),
      )
    } finally {
      setIsStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-bg flex">

      {/* ── Sidebar (desktop only, manages its own hidden md:flex) ── */}
      <HistorySidebar
        activeChatId={activeChatId}
        onLoad={loadFromHistory}
        onNewChat={startNewChat}
        onDelete={handleSidebarDelete}
      />

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-h-screen pb-16">

        {/* ── Header ── */}
        <div className="shrink-0 border-b border-line bg-paper px-4 py-3 flex items-center gap-3">
          <Link
            href={backHref}
            className="p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
            aria-label={t(lang, 'backToSchedule')}
          >
            <ArrowLeft size={16} />
          </Link>

          <div className="shrink-0 w-8 h-8 rounded-full bg-terracotta flex items-center justify-center">
            <Sparkles size={15} className="text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-[15px] font-medium text-ink leading-none">
              {t(lang, 'assistant')}
            </h1>
            <p className="text-[10px] text-muted mt-0.5">{t(lang, 'assistantSubtitle')}</p>
          </div>

          {/* Mobile — History button (hidden on desktop where sidebar is visible) */}
          <Link
            href="/assistant/history"
            className="md:hidden p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
            aria-label="Conversation history"
          >
            <History size={16} />
          </Link>

          {messages.length > 0 && (
            <button
              onClick={startNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-bg text-ink2 hover:border-ink2 text-xs font-medium transition-colors"
            >
              <RotateCcw size={12} />
              {t(lang, 'newChat')}
            </button>
          )}
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-terracotta/10 border border-terracotta/20 flex items-center justify-center">
                <Bot size={22} className="text-terracotta" />
              </div>
              <div>
                <p className="font-display text-lg font-medium text-ink">
                  {t(lang, 'assistant')}
                </p>
                <p className="text-sm text-muted mt-1">{t(lang, 'assistantEmpty')}</p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-5">
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} lang={lang} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <BottomNav role={role} />

        {/* ── Input bar ── */}
        <div className="shrink-0 border-t border-line bg-paper px-4 py-3">
          <div className="max-w-2xl mx-auto flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t(lang, 'askPlaceholder')}
              rows={1}
              disabled={isStreaming}
              className={cn(
                'flex-1 resize-none rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted',
                'focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60',
                'transition-colors min-h-[42px] max-h-40 leading-relaxed',
                'disabled:opacity-50',
              )}
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className={cn(
                'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                input.trim() && !isStreaming
                  ? 'bg-terracotta text-white hover:bg-terracotta/90'
                  : 'bg-line text-muted cursor-not-allowed',
              )}
              aria-label={t(lang, 'sendMessage')}
            >
              {isStreaming
                ? <Loader2 size={16} className="animate-spin" />
                : <Send size={16} />
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({ msg, lang }: { msg: Message; lang: LangCode }) {
  const isUser = msg.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'shrink-0 w-7 h-7 rounded-full flex items-center justify-center border',
        isUser
          ? 'bg-blue/10 border-blue/20 text-blue'
          : 'bg-terracotta/10 border-terracotta/20 text-terracotta',
      )}>
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>

      {/* Bubble */}
      <div className={cn('max-w-[78%] space-y-2', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-terracotta text-white rounded-tr-sm'
            : msg.error
              ? 'bg-paper border border-line text-ink2 rounded-tl-sm'
              : 'bg-paper border border-line text-ink rounded-tl-sm',
        )}>
          {msg.content
            ? <p className="whitespace-pre-wrap">{msg.content}</p>
            : msg.streaming && (
              <span className="inline-flex items-center gap-1 text-muted text-xs">
                <Loader2 size={12} className="animate-spin" />
                {lang === 'zh' ? '思考中…' : lang === 'bn' ? 'ভাবছি…' : 'Thinking…'}
              </span>
            )
          }
        </div>

        {/* Sources */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted uppercase tracking-widest px-1">
              {t(lang, 'assistantSources')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {msg.sources.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-line bg-paper text-[11px] text-ink2 hover:border-ink2 hover:text-ink transition-colors"
                >
                  <ExternalLink size={10} className="shrink-0" />
                  <span className="truncate max-w-[180px]">{src.title || src.url}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/app/assistant/page.tsx` to add Suspense boundary**

`useSearchParams()` in `AssistantShell` requires its tree to be wrapped in `<Suspense>` (Next.js 15 App Router requirement). Update the page:

```tsx
// src/app/assistant/page.tsx
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AssistantShell } from '@/features/assistant/AssistantShell'
import type { Role, LangCode } from '@/lib/supabase/types'

export default async function AssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type Profile = { name: string; role: string; lang: string }
  const { data: profile } = await supabase
    .from('users')
    .select('name, role, lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }

  if (!profile) redirect('/login')

  const backHref = (profile.role as Role) === 'installer' ? '/installer' : '/schedule'

  return (
    <Suspense>
      <AssistantShell
        userName={profile.name}
        role={profile.role as Role}
        lang={profile.lang as LangCode}
        backHref={backHref}
      />
    </Suspense>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/assistant/AssistantShell.tsx src/app/assistant/page.tsx
git commit -m "feat: AssistantShell — sidebar layout, loadFromHistory, mobile History button"
```

---

## Task 8: Final typecheck, push, and manual verification

- [ ] **Step 1: Full typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Push to dev**

```bash
git push origin dev
```

Wait for Vercel preview to build.

- [ ] **Step 3: Manual verification — desktop**

Open the Vercel preview `/assistant`.

1. Sidebar appears on the left (~260px) with "History" heading and a "New Chat" button at the bottom.
2. Start a conversation and navigate away — then return. The chat appears in "Today" group.
3. Hover a row — pin icon and ⋮ appear on the right.
4. Click the pin icon — chat moves to "Pinned" section.
5. Click ⋮ → "Delete conversation" → "Delete permanently?" confirmation appears → Confirm → row disappears.
6. Pin 5 chats, try to pin a 6th — toast "You can pin up to 5 conversations" appears.
7. Click a history row — its messages load into the chat area, row is highlighted.
8. Click "New Chat" in the sidebar — chat resets.

- [ ] **Step 4: Manual verification — mobile (narrow viewport)**

1. Sidebar is hidden.
2. History icon (clock) appears in the header.
3. Tap it → `/assistant/history` route loads with full-screen grouped list.
4. ⋮ is visible on each row. Tap → Pin / Delete Conversation options appear.
5. Tap a row → navigates to `/assistant?chat=<id>` → that conversation loads.
6. Back button on history page returns to assistant.

- [ ] **Step 5: Verify Supabase — confirm migration applied**

In Supabase Table Editor, verify `asst_chats` has `pinned boolean` column. Check that pinning a chat sets `pinned = true` in the DB.
