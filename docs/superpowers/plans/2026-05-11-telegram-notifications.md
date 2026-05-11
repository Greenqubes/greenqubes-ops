# Telegram Notification Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `[PLACEHOLDER]` Telegram notification templates with finalised copy and update all callers to pass the new params defined in the design spec.

**Architecture:** All template functions live in `src/lib/telegram/templates.ts`. Each API route that sends a notification fetches the required job fields and calls the template. A new `getJobNotifData` query helper centralises the job field fetch so routes stay lean. A new `tplJobAssigned` template notifies installers when a job is approved.

**Tech Stack:** Next.js 15 API routes, Supabase (service client for notification queries), TypeScript strict

**Design system reference:** `design-system/greenqubes-ops/MASTER.md` — consult for any UI component changes touched during implementation.

**Spec:** `docs/superpowers/specs/2026-05-11-telegram-notifications-design.md`

---

## File Map

| File | Change |
|------|--------|
| `src/lib/telegram/templates.ts` | Rewrite all templates — new params, new copy, add `tplJobAssigned`, fix `tplBugReport` |
| `src/lib/supabase/queries/notifications.ts` | Add `getJobNotifData`, update `OverdueJob` type + `getOverdueJobs` |
| `src/app/api/jobs/[id]/approve/route.ts` | Use `getJobNotifData`, add `tplJobAssigned` send to installers |
| `src/app/api/jobs/[id]/send-back/route.ts` | Use `getJobNotifData`, pass new params |
| `src/app/api/jobs/[id]/submit/route.ts` | Use `getJobNotifData`, pass new params |
| `src/app/api/jobs/[id]/messages/route.ts` | Add `getJobNotifData` call, pass new params |
| `src/app/api/notifications/overdue/route.ts` | Pass new params from updated `getOverdueJobs` |
| `src/app/api/bugs/route.ts` | Remove `screen`/`ip` from `tplBugReport` call |
| `.env.local` | Add `NEXT_PUBLIC_APP_URL` |

---

## Task 1: Rewrite `templates.ts`

**Files:**
- Modify: `src/lib/telegram/templates.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d} ${months[m - 1]} ${y}`
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

function pocLines(name: string | null, phone: string | null): string {
  return `POC: ${name ?? '(NIL)'}\nContact: ${phone ?? '(NIL)'}`
}

function dateLine(date: string, timeStart: string | null, timeEnd: string | null): string {
  return timeStart && timeEnd
    ? `${formatDate(date)}, ${formatTime(timeStart)} – ${formatTime(timeEnd)}`
    : formatDate(date)
}

// ─── Job notifications ────────────────────────────────────────────────────────

export function tplJobSubmittedForApproval(p: {
  projectTitle: string | null
  jobClient:    string
  pocName:      string | null
  pocPhone:     string | null
  jobDate:      string
  timeStart:    string | null
  timeEnd:      string | null
  salesName:    string
  jobUrl:       string
}): string {
  return (
    `📋 <b>Approval Requested</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${dateLine(p.jobDate, p.timeStart, p.timeEnd)}\n` +
    `Submitted by: ${p.salesName}\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

export function tplJobApproved(p: {
  projectTitle:  string | null
  jobClient:     string
  pocName:       string | null
  pocPhone:      string | null
  jobDate:       string
  timeStart:     string | null
  timeEnd:       string | null
  schedulerName: string
  jobUrl:        string
}): string {
  return (
    `✅ <b>Job Approved</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${dateLine(p.jobDate, p.timeStart, p.timeEnd)}\n` +
    `Approved by: ${p.schedulerName}\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

export function tplJobAssigned(p: {
  projectTitle: string | null
  jobClient:    string
  pocName:      string | null
  pocPhone:     string | null
  jobDate:      string
  timeStart:    string | null
  timeEnd:      string | null
  location:     string
  jobUrl:       string
}): string {
  return (
    `📅 <b>Job Assigned</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${dateLine(p.jobDate, p.timeStart, p.timeEnd)}\n` +
    `📍 ${p.location}\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

export function tplJobSentBack(p: {
  projectTitle:  string | null
  jobClient:     string
  pocName:       string | null
  pocPhone:      string | null
  jobDate:       string
  schedulerName: string
  sentAt:        string
  note?:         string
  jobUrl:        string
}): string {
  const noteLine = p.note ? `Note: <i>"${p.note}"</i>\n` : ''
  return (
    `↩️ <b>Job Sent Back</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${formatDate(p.jobDate)}\n` +
    `Sent back by: ${p.schedulerName}\n` +
    `Sent at: ${p.sentAt}\n` +
    noteLine + `\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

export function tplJobOverdue(p: {
  projectTitle: string | null
  jobClient:    string
  pocName:      string | null
  pocPhone:     string | null
  jobDate:      string
  timeEnd:      string
  location:     string
  jobUrl:       string
}): string {
  return (
    `⏰ <b>Job Overdue</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${formatDate(p.jobDate)}\n` +
    `Scheduled until: ${p.timeEnd}\n` +
    `📍 ${p.location}\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

export function tplJobMessage(p: {
  projectTitle: string | null
  jobClient:    string
  pocName:      string | null
  pocPhone:     string | null
  jobDate:      string
  authorName:   string
  sentAt:       string
  preview:      string
  jobUrl:       string
}): string {
  return (
    `💬 <b>New Message</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${formatDate(p.jobDate)}\n` +
    `From: ${p.authorName}\n` +
    `Sent at: ${p.sentAt}\n` +
    `<i>"${p.preview}"</i>\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

export function tplJobVoiceNote(p: {
  projectTitle: string | null
  jobClient:    string
  pocName:      string | null
  pocPhone:     string | null
  jobDate:      string
  authorName:   string
  sentAt:       string
  jobUrl:       string
}): string {
  return (
    `🎤 <b>Voice Note</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${formatDate(p.jobDate)}\n` +
    `From: ${p.authorName}\n` +
    `Sent at: ${p.sentAt}\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

// ─── Bug report ───────────────────────────────────────────────────────────────

export function tplBugReport(p: {
  priority:       string
  sgtTime:        string
  platform:       string
  os:             string
  userEmail:      string
  userRole:       string
  route:          string
  message:        string
  screenshotUrl?: string
}): string {
  const emoji = p.priority === 'urgent' ? '🚨' : p.priority === 'high' ? '🔴' : p.priority === 'medium' ? '🟡' : '🟢'
  const screenshotLine = p.screenshotUrl ? `\n<a href="${p.screenshotUrl}">View screenshot →</a>` : ''
  return (
    `${emoji} <b>Bug Report</b> — ${p.priority.toUpperCase()}\n` +
    `——————————————————\n` +
    `Reported by: ${p.userEmail} (${p.userRole})\n` +
    `Time: ${p.sgtTime}\n` +
    `Page: ${p.route}\n` +
    `Platform: ${p.platform} · ${p.os}\n` +
    `——————————————————\n` +
    `<i>"${p.message}"</i>` +
    screenshotLine
  )
}

// ─── Monday digest ────────────────────────────────────────────────────────────

export function tplDigestHeader(p: {
  weekOf: string
  count:  number
}): string {
  return (
    `📊 <b>Monday Digest — week of ${p.weekOf}</b>\n` +
    `——————————————————\n` +
    `${p.count} important conversation${p.count !== 1 ? 's' : ''} from last week.\n` +
    `Review each below and vote to promote to the knowledge base.`
  )
}

export function tplDigestItem(p: {
  index:      number
  topic:      string
  date:       string
  importance: number
  summary:    string
}): string {
  const stars = '★'.repeat(p.importance) + '☆'.repeat(5 - p.importance)
  return (
    `<b>${p.index}. ${p.topic}</b>\n` +
    `${stars}\n` +
    `<i>${p.date}</i>\n` +
    `——————————————————\n` +
    `${p.summary}\n` +
    `——————————————————\n` +
    `Promote this to the knowledge base?`
  )
}

export function tplVoteStatus(p: {
  index:       number
  topic:       string
  date:        string
  importance:  number
  summary:     string
  yesCount:    number
  noCount:     number
  totalVoters: number
  outcome:     'pending' | 'promoted' | 'dismissed'
}): string {
  const stars = '★'.repeat(p.importance) + '☆'.repeat(5 - p.importance)
  const header = (
    `<b>${p.index}. ${p.topic}</b>\n` +
    `${stars}\n` +
    `<i>${p.date}</i>\n` +
    `——————————————————\n` +
    `${p.summary}\n` +
    `——————————————————\n`
  )
  const awaiting = p.totalVoters - p.yesCount - p.noCount
  if (p.outcome === 'promoted') return header + `✅ Promoted — added to knowledge base.`
  if (p.outcome === 'dismissed') return header + `❌ Dismissed — skipped.`
  return header + `📊 ${p.yesCount} Yes · ${p.noCount} No · ${awaiting} awaiting (${p.totalVoters} voters)`
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: errors about callers passing old param shapes — these will be fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/telegram/templates.ts
git commit -m "feat: rewrite telegram notification templates with finalised copy"
```

---

## Task 2: Add `getJobNotifData` + update `getOverdueJobs`

**Files:**
- Modify: `src/lib/supabase/queries/notifications.ts`

- [ ] **Step 1: Add `JobNotifData` type and `getJobNotifData` helper**

Add after the `getSchedulers` function:

```typescript
export type JobNotifData = {
  project_title:    string | null
  client:           string
  client_poc_name:  string | null
  client_poc_phone: string | null
  date:             string
  time_start:       string | null
  time_end:         string | null
  location:         string
}

export async function getJobNotifData(jobId: string): Promise<JobNotifData | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('jobs')
    .select('project_title, client, client_poc_name, client_poc_phone, date, time_start, time_end, location')
    .eq('id', jobId)
    .maybeSingle()
  return data as JobNotifData | null
}
```

- [ ] **Step 2: Update `OverdueJob` type to include new fields**

Replace the existing `OverdueJob` type:

```typescript
export type OverdueJob = {
  id:               string
  project_title:    string | null
  client:           string
  client_poc_name:  string | null
  client_poc_phone: string | null
  date:             string
  time_start:       string | null
  time_end:         string | null
  location:         string
  sales_poc:        { id: string; telegram_chat_id: string | null } | null
  job_assignees:    Array<{
    users: { id: string; telegram_chat_id: string | null } | null
  }>
}
```

- [ ] **Step 3: Update `getOverdueJobs` select to include new fields**

Replace the `.select(...)` call inside `getOverdueJobs`:

```typescript
const { data, error } = await supabase
  .from('jobs')
  .select(`
    id, project_title, client, client_poc_name, client_poc_phone,
    date, time_start, time_end, location,
    sales_poc:users!jobs_sales_poc_id_fkey ( id, telegram_chat_id ),
    job_assignees ( users ( id, telegram_chat_id ) )
  `)
  .eq('status', 'scheduled')
  .lte('date', todaySGT)
```

- [ ] **Step 4: Type-check**

```bash
npm run type-check
```

Expected: errors in `overdue/route.ts` about missing new params — fixed in Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries/notifications.ts
git commit -m "feat: add getJobNotifData helper and update OverdueJob type"
```

---

## Task 3: Update `approve/route.ts`

**Files:**
- Modify: `src/app/api/jobs/[id]/approve/route.ts`
- Modify: `.env.local`

- [ ] **Step 1: Add `NEXT_PUBLIC_APP_URL` to `.env.local`**

Add this line to `.env.local`:

```
NEXT_PUBLIC_APP_URL=https://greenqubes-ops.vercel.app
```

Also add it to Vercel environment variables (Settings → Environment Variables).

- [ ] **Step 2: Replace the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getJobRecipients, getJobNotifData } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobApproved, tplJobAssigned } from '@/lib/telegram/templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; name: string; role: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile || profile.role !== 'scheduler') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const job = await getJobNotifData(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase
    .from('jobs')
    .update({
      status:      'scheduled',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    } as never)
    .eq('id', jobId)
    .throwOnError()

  const jobUrl = `${APP_URL}/jobs/${jobId}`
  const { salesPoc, installers } = await getJobRecipients(jobId)

  // Notify sales POC
  if (salesPoc?.telegram_chat_id) {
    await sendTelegram(
      salesPoc.telegram_chat_id,
      tplJobApproved({
        projectTitle:  job.project_title,
        jobClient:     job.client,
        pocName:       job.client_poc_name,
        pocPhone:      job.client_poc_phone,
        jobDate:       job.date,
        timeStart:     job.time_start,
        timeEnd:       job.time_end,
        schedulerName: profile.name,
        jobUrl,
      }),
    )
  }

  // Notify each assigned installer
  await Promise.all(
    installers
      .filter(i => i.telegram_chat_id)
      .map(i => sendTelegram(
        i.telegram_chat_id!,
        tplJobAssigned({
          projectTitle: job.project_title,
          jobClient:    job.client,
          pocName:      job.client_poc_name,
          pocPhone:     job.client_poc_phone,
          jobDate:      job.date,
          timeStart:    job.time_start,
          timeEnd:      job.time_end,
          location:     job.location,
          jobUrl,
        }),
      )),
  )

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```

Expected: no errors in this file.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/jobs/[id]/approve/route.ts .env.local
git commit -m "feat: update approve route — job approved + job assigned notifications"
```

---

## Task 4: Update `send-back/route.ts`

**Files:**
- Modify: `src/app/api/jobs/[id]/send-back/route.ts`

- [ ] **Step 1: Replace the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { insertMessage } from '@/lib/supabase/queries/jobs'
import { getJobRecipients, getJobNotifData } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobSentBack } from '@/lib/telegram/templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

function sgtTimeNow(): string {
  return new Date().toLocaleTimeString('en-SG', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Singapore',
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; name: string; role: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile || profile.role !== 'scheduler') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { note } = await req.json() as { note?: string }
  const trimmedNote = note?.trim() ?? ''

  const job = await getJobNotifData(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase
    .from('jobs')
    .update({ status: 'pending' } as never)
    .eq('id', jobId)
    .throwOnError()

  if (trimmedNote) {
    await insertMessage(jobId, profile.id, `[Sent back] ${trimmedNote}`)
  }

  const { salesPoc } = await getJobRecipients(jobId)
  if (salesPoc?.telegram_chat_id) {
    await sendTelegram(
      salesPoc.telegram_chat_id,
      tplJobSentBack({
        projectTitle:  job.project_title,
        jobClient:     job.client,
        pocName:       job.client_poc_name,
        pocPhone:      job.client_poc_phone,
        jobDate:       job.date,
        schedulerName: profile.name,
        sentAt:        sgtTimeNow(),
        note:          trimmedNote || undefined,
        jobUrl:        `${APP_URL}/jobs/${jobId}`,
      }),
    )
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/jobs/[id]/send-back/route.ts
git commit -m "feat: update send-back route notification with project title and POC fields"
```

---

## Task 5: Update `submit/route.ts`

**Files:**
- Modify: `src/app/api/jobs/[id]/submit/route.ts`

- [ ] **Step 1: Replace the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSchedulers, getJobNotifData } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobSubmittedForApproval } from '@/lib/telegram/templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; name: string; role: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile || profile.role !== 'sales') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const newDate: string | undefined = typeof body.date === 'string' ? body.date : undefined

  const patch: Record<string, unknown> = { status: 'awaiting_approval' }
  if (newDate) patch.date = newDate

  await supabase
    .from('jobs')
    .update(patch as never)
    .eq('id', jobId)
    .throwOnError()

  // Fetch after update so date reflects any change
  const job = await getJobNotifData(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const message = tplJobSubmittedForApproval({
    projectTitle: job.project_title,
    jobClient:    job.client,
    pocName:      job.client_poc_name,
    pocPhone:     job.client_poc_phone,
    jobDate:      job.date,
    timeStart:    job.time_start,
    timeEnd:      job.time_end,
    salesName:    profile.name,
    jobUrl:       `${APP_URL}/jobs/${jobId}`,
  })

  const schedulers = await getSchedulers()
  await Promise.all(
    schedulers
      .filter(s => s.telegram_chat_id)
      .map(s => sendTelegram(s.telegram_chat_id!, message)),
  )

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/jobs/[id]/submit/route.ts
git commit -m "feat: update submit route notification with project title and POC fields"
```

---

## Task 6: Update `messages/route.ts`

**Files:**
- Modify: `src/app/api/jobs/[id]/messages/route.ts`

- [ ] **Step 1: Add `getJobNotifData` import and `sgtTimeNow` helper, update notification calls**

Replace the file:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getJobById, insertMessage, insertVoiceMessage } from '@/lib/supabase/queries/jobs'
import { getJobRecipients, getJobNotifData } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobMessage, tplJobVoiceNote } from '@/lib/telegram/templates'

const CHAT_OPEN_DAYS = 7
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

function sgtTimeNow(): string {
  return new Date().toLocaleTimeString('en-SG', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Singapore',
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; name: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, name')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: authorId, name: authorName } = profile

  const job = await getJobById(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (job.status === 'completed' && job.completed_at) {
    const cutoff = new Date(job.completed_at)
    cutoff.setDate(cutoff.getDate() + CHAT_OPEN_DAYS)
    if (new Date() > cutoff) {
      return NextResponse.json({ error: 'Chat closed' }, { status: 403 })
    }
  }

  const body = await req.json() as { content?: string; kind?: string; voice_url?: string }
  const isVoice = body.kind === 'voice'

  // Fetch notification data (project title, POC fields)
  const notifData = await getJobNotifData(jobId)
  const jobUrl = `${APP_URL}/jobs/${jobId}`

  // ── Telegram helpers ──────────────────────────────────────────────────────
  async function notifyParticipants(tgMessage: string) {
    const { salesPoc, installers } = await getJobRecipients(jobId)
    const recipients = [salesPoc, ...installers].filter(
      (r): r is NonNullable<typeof r> =>
        r !== null && r.id !== authorId && r.telegram_chat_id !== null,
    )
    await Promise.all(recipients.map(r => sendTelegram(r.telegram_chat_id!, tgMessage)))
  }

  // ── Voice note ────────────────────────────────────────────────────────────
  if (isVoice) {
    const voiceUrl = body.voice_url?.trim()
    if (!voiceUrl) return NextResponse.json({ error: 'voice_url required' }, { status: 400 })

    const message = await insertVoiceMessage(jobId, authorId, voiceUrl)

    if (notifData) {
      await notifyParticipants(tplJobVoiceNote({
        projectTitle: notifData.project_title,
        jobClient:    notifData.client,
        pocName:      notifData.client_poc_name,
        pocPhone:     notifData.client_poc_phone,
        jobDate:      notifData.date,
        authorName,
        sentAt:       sgtTimeNow(),
        jobUrl,
      }))
    }

    return NextResponse.json({ message })
  }

  // ── Text message ──────────────────────────────────────────────────────────
  const content = body.content?.trim() ?? ''
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const message = await insertMessage(jobId, authorId, content)

  if (notifData) {
    await notifyParticipants(tplJobMessage({
      projectTitle: notifData.project_title,
      jobClient:    notifData.client,
      pocName:      notifData.client_poc_name,
      pocPhone:     notifData.client_poc_phone,
      jobDate:      notifData.date,
      authorName,
      sentAt:       sgtTimeNow(),
      preview:      content.slice(0, 100),
      jobUrl,
    }))
  }

  return NextResponse.json({ message })
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/jobs/[id]/messages/route.ts
git commit -m "feat: update messages route notifications with project title, POC, and sentAt"
```

---

## Task 7: Update `overdue/route.ts`

**Files:**
- Modify: `src/app/api/notifications/overdue/route.ts`

- [ ] **Step 1: Replace the `tplJobOverdue` call block**

The `tplJobOverdue` call and the `timeEnd` formatting block are currently:

```typescript
const timeEnd = job.time_end
  ? (() => {
      const [h, m] = job.time_end!.split(':').map(Number)
      const suffix = h >= 12 ? 'pm' : 'am'
      const h12    = h % 12 || 12
      return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`
    })()
  : 'end of day'

const msg = tplJobOverdue({
  jobClient: job.client,
  jobDate:   job.date,
  timeEnd,
  location:  job.location,
})
```

Replace with:

```typescript
const timeEnd = job.time_end
  ? (() => {
      const [h, m] = job.time_end!.split(':').map(Number)
      const suffix = h >= 12 ? 'PM' : 'AM'
      const h12    = h % 12 || 12
      return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`
    })()
  : 'end of day'

const jobUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'}/jobs/${job.id}`

const msg = tplJobOverdue({
  projectTitle: job.project_title,
  jobClient:    job.client,
  pocName:      job.client_poc_name,
  pocPhone:     job.client_poc_phone,
  jobDate:      job.date,
  timeEnd,
  location:     job.location,
  jobUrl,
})
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifications/overdue/route.ts
git commit -m "feat: update overdue notification with project title and POC fields"
```

---

## Task 8: Update `bugs/route.ts`

**Files:**
- Modify: `src/app/api/bugs/route.ts`

- [ ] **Step 1: Update the `tplBugReport` call**

Find this block in `bugs/route.ts`:

```typescript
const tgMsg = tplBugReport({
  priority: body.priority, sgtTime, platform, os,
  screen:   body.screen, ip, userEmail, userRole,
  route:    body.route, message: body.message,
  screenshotUrl: screenshotUrl || undefined,
})
```

Replace with:

```typescript
const tgMsg = tplBugReport({
  priority:      body.priority,
  sgtTime,
  platform,
  os,
  userEmail,
  userRole,
  route:         body.route,
  message:       body.message,
  screenshotUrl: screenshotUrl || undefined,
})
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bugs/route.ts
git commit -m "feat: update bug report notification — remove screen/ip, apply new style"
```

---

## Task 9: Final type-check + push

- [ ] **Step 1: Full type-check**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 2: Push to dev**

```bash
git push origin dev
```

- [ ] **Step 3: Verify on Vercel preview**

Test each notification type manually:
1. Submit a job for approval → scheduler receives Approval Requested
2. Approve a job → sales receives Job Approved, each installer receives Job Assigned
3. Send a job back → sales receives Job Sent Back with timestamp
4. Post a chat message → sales POC + installers receive New Message
5. Post a voice note → sales POC + installers receive Voice Note
6. Submit a bug report → greenqubes_bugs_bot receives Bug Report
7. Trigger overdue cron manually → `GET /api/notifications/overdue` with `Authorization: Bearer <CRON_SECRET>`

---

## Self-Review Notes

- **Spec coverage:** All 10 template types covered across 9 tasks. `tplJobAssigned` is new (Task 1 + Task 3). Bug report redesign in Task 8. Monday digest templates updated in Task 1 (no caller changes needed — digest params unchanged).
- **Type consistency:** `pocName`/`pocPhone` param names used consistently across all templates and callers. `getJobNotifData` returns `client_poc_name`/`client_poc_phone` (DB column names) — callers map these to `pocName`/`pocPhone`.
- **`sgtTimeNow`** defined identically in `send-back/route.ts` and `messages/route.ts` — acceptable duplication at this scale; extract only if a third caller appears.
- **Monday digest callers** (`scripts/monday-digest.ts`, `src/lib/digest/run.ts`, `src/app/api/telegram/webhook/route.ts`) — `tplDigestHeader`, `tplDigestItem`, `tplVoteStatus` param signatures are **unchanged**; no caller updates needed.
