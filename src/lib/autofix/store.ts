// Database access for the auto-fixer — service key, server-side only.
//
// The tables (migration 0069) are not in the hand-written types.ts, hence the
// `as never` table names, the same pattern as app_settings / job_bin. Every
// function swallows its error into an empty answer and logs "[autofix]": the
// fixer is an add-on, and a failed read must never break a route it sits in.

import { createServiceClient } from '@/lib/supabase/service'
import type { CrashRow } from './crash-signature'
import type { Item, Note } from './actions'
import { RUN_STALE_MINUTES } from './scheduling'
import { sgtDate } from './whats-new'

export type ItemRow = Item & {
  source:          'bug' | 'crash'
  bug_report_id:   string | null
  crash_signature: string | null
  whats_new_line:  string | null
  diff_files:      number | null
  diff_lines:      number | null
  merge_sha:       string | null
  going_live_at:   string | null
  live_build_id:   string | null
  dev_sync_needed: boolean
  reported_run_id: string | null
  created_at:      string
  updated_at:      string
}

export type RunRow = {
  id:          string
  kind:        'nightly' | 'retry'
  fired_at:    string
  session_url: string | null
  finished_at: string | null
  outcome:     string | null
  alerted:     boolean
}

export type BugRow = {
  id:             string
  created_at:     string
  route:          string | null
  user_role:      string | null
  user_email:     string | null
  priority:       string
  message:        string
  screenshot_key: string | null
  build_id?:      string | null
}

const db = () => createServiceClient()
const items = () => db().from('autofix_items' as never)
const runs  = () => db().from('autofix_runs' as never)
const chat  = () => db().from('autofix_chat' as never)

function fail(where: string, error: unknown) {
  console.error(`[autofix] ${where} failed`, error)
}

const OPEN_STATUSES = ['new', 'fixing', 'awaiting_nic', 'going_live', 'retry', 'needs_session']

// ── items ──────────────────────────────────────────────────────────────────

export async function getItemByNo(no: number): Promise<ItemRow | null> {
  const { data, error } = await items().select('*').eq('no', no).maybeSingle()
  if (error) { fail('getItemByNo', error); return null }
  return data as ItemRow | null
}

export async function getItem(id: string): Promise<ItemRow | null> {
  const { data, error } = await items().select('*').eq('id', id).maybeSingle()
  if (error) { fail('getItem', error); return null }
  return data as ItemRow | null
}

export async function insertItem(row: Partial<ItemRow>): Promise<ItemRow | null> {
  const { data, error } = await items().insert(row as never).select('*').single()
  if (error) { fail('insertItem', error); return null }
  return data as ItemRow
}

export async function updateItem(id: string, patch: Partial<ItemRow>): Promise<boolean> {
  const { error } = await items().update({ ...patch, updated_at: new Date().toISOString() } as never).eq('id', id)
  if (error) { fail('updateItem', error); return false }
  return true
}

export async function itemsByStatus(statuses: string[]): Promise<ItemRow[]> {
  const { data, error } = await items().select('*').in('status', statuses).order('no')
  if (error) { fail('itemsByStatus', error); return [] }
  return (data ?? []) as ItemRow[]
}

export async function listItems(filter: 'awaiting' | 'recent' | 'open'): Promise<ItemRow[]> {
  if (filter === 'awaiting') return itemsByStatus(['awaiting_nic', 'going_live'])
  if (filter === 'open')     return itemsByStatus(OPEN_STATUSES)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await items().select('*').gte('updated_at', since).order('updated_at', { ascending: false }).limit(30)
  if (error) { fail('listItems', error); return [] }
  return (data ?? []) as ItemRow[]
}

export async function itemsForRun(runId: string): Promise<ItemRow[]> {
  const { data, error } = await items().select('*').eq('reported_run_id', runId).order('no')
  if (error) { fail('itemsForRun', error); return [] }
  return (data ?? []) as ItemRow[]
}

export async function itemForBug(bugId: string): Promise<ItemRow | null> {
  const { data, error } = await items().select('*').eq('bug_report_id', bugId).maybeSingle()
  if (error) { fail('itemForBug', error); return null }
  return data as ItemRow | null
}

export async function latestItemForSignature(signature: string): Promise<ItemRow | null> {
  const { data, error } = await items().select('*').eq('crash_signature', signature)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) { fail('latestItemForSignature', error); return null }
  return data as ItemRow | null
}

export async function retryItems(): Promise<ItemRow[]> {
  return itemsByStatus(['retry'])
}

export async function appendNote(item: Item, note: Note): Promise<boolean> {
  return updateItem(item.id, { nic_notes: [...item.nic_notes, note] })
}

// ── crashes and bug reports ───────────────────────────────────────────────

/** Unresolved crash rows not yet linked to an item. [] before migration 0069. */
export async function unattachedCrashes(): Promise<CrashRow[]> {
  const { data, error } = await db().from('crash_logs').select('*')
    .eq('resolved', false).is('autofix_item_id' as never, null).order('occurred_at').limit(1000)
  if (error) { fail('unattachedCrashes', error); return [] }
  return (data ?? []) as unknown as CrashRow[]
}

export async function attachCrashes(rowIds: string[], itemId: string, resolve: boolean): Promise<void> {
  if (rowIds.length === 0) return
  const patch: Record<string, unknown> = { autofix_item_id: itemId }
  if (resolve) patch.resolved = true
  const { error } = await db().from('crash_logs').update(patch as never).in('id', rowIds)
  if (error) fail('attachCrashes', error)
}

/** The newest few crash rows of an item — context for a retry. */
export async function crashesForItem(itemId: string, limit = 3): Promise<CrashRow[]> {
  const { data, error } = await db().from('crash_logs').select('*')
    .eq('autofix_item_id' as never, itemId).order('occurred_at', { ascending: false }).limit(limit)
  if (error) { fail('crashesForItem', error); return [] }
  return (data ?? []) as unknown as CrashRow[]
}

export async function resolveCrashesOfItem(itemId: string): Promise<void> {
  const { error } = await db().from('crash_logs').update({ resolved: true } as never).eq('autofix_item_id' as never, itemId)
  if (error) fail('resolveCrashesOfItem', error)
}

/** Open reports with no item yet — what the fixer has never looked at. */
export async function newBugReports(): Promise<BugRow[]> {
  const { data, error } = await db().from('bug_reports').select('*').eq('status', 'open').order('created_at')
  if (error) { fail('newBugReports', error); return [] }
  const open = (data ?? []) as unknown as BugRow[]
  if (open.length === 0) return []
  const { data: linked, error: e2 } = await items().select('bug_report_id').in('bug_report_id', open.map(b => b.id))
  if (e2) { fail('newBugReports(linked)', e2); return [] } // no tables yet → nothing to send
  const seen = new Set(((linked ?? []) as { bug_report_id: string }[]).map(r => r.bug_report_id))
  return open.filter(b => !seen.has(b.id))
}

export async function getBugReport(id: string): Promise<BugRow | null> {
  const { data, error } = await db().from('bug_reports').select('*').eq('id', id).maybeSingle()
  if (error) { fail('getBugReport', error); return null }
  return data as unknown as BugRow | null
}

export async function setBugStatus(id: string, status: 'fixed' | 'closed'): Promise<void> {
  const patch = status === 'fixed'
    ? { status, resolved_at: new Date().toISOString() }
    : { status }
  const { error } = await db().from('bug_reports').update(patch as never).eq('id', id)
  if (error) fail('setBugStatus', error)
}

export async function userNamesByEmail(emails: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (emails.length === 0) return out
  const { data, error } = await db().from('users').select('email, name').in('email', emails)
  if (error) { fail('userNamesByEmail', error); return out }
  for (const u of (data ?? []) as { email: string; name: string | null }[]) if (u.name) out.set(u.email, u.name)
  return out
}

// ── runs ──────────────────────────────────────────────────────────────────

export async function createRun(kind: 'nightly' | 'retry'): Promise<string | null> {
  const { data, error } = await runs().insert({ kind } as never).select('id').single()
  if (error) { fail('createRun', error); return null }
  return (data as { id: string }).id
}

export async function getRun(id: string): Promise<RunRow | null> {
  const { data, error } = await runs().select('*').eq('id', id).maybeSingle()
  if (error) { fail('getRun', error); return null }
  return data as RunRow | null
}

export async function setRunSession(id: string, url: string | null): Promise<void> {
  const { error } = await runs().update({ session_url: url } as never).eq('id', id)
  if (error) fail('setRunSession', error)
}

/**
 * Marks a run finished — only if it is not finished already, so a second
 * report for the same run (a cloud retry) is refused rather than applied twice.
 * Returns whether THIS call finished it.
 */
export async function finishRun(id: string, outcome: string): Promise<boolean> {
  const { data, error } = await runs()
    .update({ finished_at: new Date().toISOString(), outcome } as never)
    .eq('id', id).is('finished_at', null).select('id')
  if (error) { fail('finishRun', error); return false }
  return ((data ?? []) as unknown[]).length === 1
}

/** Fires since 00:00 Singapore time today. */
export async function firesTodaySgt(): Promise<number> {
  const startSgt = new Date(`${sgtDate(new Date().toISOString())}T00:00:00+08:00`).toISOString()
  const { count, error } = await runs().select('id', { count: 'exact', head: true }).gte('fired_at', startSgt)
  if (error) { fail('firesTodaySgt', error); return Number.MAX_SAFE_INTEGER } // unknown → don't fire
  return count ?? 0
}

export async function runInFlight(): Promise<boolean> {
  const since = new Date(Date.now() - RUN_STALE_MINUTES * 60_000).toISOString()
  const { count, error } = await runs().select('id', { count: 'exact', head: true })
    .is('finished_at', null).gte('fired_at', since)
  if (error) { fail('runInFlight', error); return true } // unknown → don't fire
  return (count ?? 0) > 0
}

export async function staleUnalertedRuns(): Promise<RunRow[]> {
  const before = new Date(Date.now() - RUN_STALE_MINUTES * 60_000).toISOString()
  const { data, error } = await runs().select('*').is('finished_at', null).eq('alerted', false).lt('fired_at', before)
  if (error) { fail('staleUnalertedRuns', error); return [] }
  return (data ?? []) as RunRow[]
}

export async function markRunAlerted(id: string): Promise<void> {
  const { error } = await runs().update({ alerted: true } as never).eq('id', id)
  if (error) fail('markRunAlerted', error)
}

// ── the bug-bot conversation ──────────────────────────────────────────────

export async function chatHistory(limit = 20): Promise<{ role: 'nic' | 'bot'; text: string }[]> {
  const { data, error } = await chat().select('role, text, created_at').order('created_at', { ascending: false }).limit(limit)
  if (error) { fail('chatHistory', error); return [] }
  return ((data ?? []) as { role: 'nic' | 'bot'; text: string }[]).reverse()
}

/** False when this Telegram update was already handled (Telegram retried it). */
export async function addChat(role: 'nic' | 'bot', text: string, updateId?: number): Promise<boolean> {
  const { error } = await chat().insert({ role, text, telegram_update_id: updateId ?? null } as never)
  if (error) {
    if ((error as { code?: string }).code === '23505') return false
    fail('addChat', error)
  }
  return true
}
