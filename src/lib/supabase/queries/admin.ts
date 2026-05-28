import { createServiceClient } from '@/lib/supabase/service'
import type { Role, LangCode }  from '@/lib/supabase/types'

// ── User management ────────────────────────────────────────────────────────────

export type AdminUser = {
  id:                string
  auth_id:           string | null
  email:             string | null
  name:              string
  role:              Role
  telegram_chat_id:  string | null
  lang:              LangCode
  phone:             string | null
  digest_subscriber: boolean
  years_experience:  number | null
  skills:            string[]
  created_at:        string
  deleted_at:        string | null
}

export async function getAllUsers(): Promise<AdminUser[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('users')
    .select('id, auth_id, email, name, role, telegram_chat_id, lang, phone, digest_subscriber, years_experience, skills, created_at, deleted_at')
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as AdminUser[]
}

export async function provisionUser(
  email: string,
  name:  string,
  role:  Role,
  lang:  LangCode = 'en',
): Promise<AdminUser> {
  const db = createServiceClient()

  // Prevent duplicate provisioning by email
  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  if (existing) throw new Error(`${email} is already provisioned.`)

  const { data, error } = await db
    .from('users')
    .insert({
      email:             email.toLowerCase(),
      auth_id:           null,
      name,
      role,
      lang,
      digest_subscriber: false,
      visibility:        ['public-internal'],
    } as never)
    .select()
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`${email} is already provisioned.`)
    throw error
  }
  return data as unknown as AdminUser
}

export async function updateUser(
  id:    string,
  patch: Partial<Pick<AdminUser, 'role' | 'telegram_chat_id' | 'digest_subscriber' | 'lang' | 'phone' | 'years_experience' | 'skills'>>,
): Promise<void> {
  const db = createServiceClient()
  const { error } = await db.from('users').update(patch as never).eq('id', id)
  if (error) throw error
}

export async function removeUserAccess(id: string): Promise<void> {
  const db = createServiceClient()

  // Fetch the user to check safety guards
  const { data: user, error: fetchError } = await db
    .from('users')
    .select('id, name, auth_id, deleted_at')
    .eq('id', id)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!user) throw new Error('User not found.')

  // Safety guard: never delete GreenqubesAI
  if (user.name === 'GreenqubesAI') {
    throw new Error('This account cannot be removed.')
  }
  // TODO: replace with a stable system-user flag

  // Safety guard: cannot operate on already soft-deleted users
  if (user.deleted_at !== null) {
    throw new Error('This user has already been removed.')
  }

  // Path A: Provisioned user (auth_id is null, never signed in) — hard delete
  if (user.auth_id === null) {
    const { error: deleteError } = await db.from('users').delete().eq('id', id)
    if (deleteError) throw deleteError
    return
  }

  // Path B: Active/past employee (auth_id is not null) — revoke auth first, then soft delete
  // Revoke Supabase Auth access using admin client — if this fails, nothing is written (retryable)
  const { error: authError } = await db.auth.admin.deleteUser(user.auth_id)
  if (authError) throw authError

  // Then stamp the row — auth is already gone at this point
  const { error: softDeleteError } = await db
    .from('users')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (softDeleteError) throw softDeleteError
}

// ── Digest ─────────────────────────────────────────────────────────────────────

export type DigestItem = {
  id:         string
  topic:      string | null
  tags:       string[] | null
  importance: number | null
  ts:         string
  yes_votes:  number
  no_votes:   number
  status:     'pending' | 'promoted' | 'dismissed'
}

export type DigestSubscriber = {
  id:                string
  name:              string
  role:              Role
  telegram_chat_id:  string
  digest_subscriber: boolean
}

export async function getDigestItems(): Promise<DigestItem[]> {
  const db = createServiceClient()

  const [{ data: chats, error: chatErr }, { data: votes, error: voteErr }] = await Promise.all([
    db.from('asst_chats')
      .select('id, topic, tags, importance, ts')
      .gte('importance', 4)
      .order('importance', { ascending: false })
      .order('ts',         { ascending: false }),
    db.from('digest_votes').select('chat_id, vote'),
  ])
  if (chatErr) throw chatErr
  if (voteErr) throw voteErr

  const voteMap = new Map<string, { yes: number; no: number }>()
  for (const v of votes ?? []) {
    const cur = voteMap.get(v.chat_id) ?? { yes: 0, no: 0 }
    if (v.vote === 'yes') cur.yes++; else cur.no++
    voteMap.set(v.chat_id, cur)
  }

  return (chats ?? []).map(c => {
    const v     = voteMap.get(c.id) ?? { yes: 0, no: 0 }
    const total = v.yes + v.no
    let status: DigestItem['status'] = 'pending'
    if (total > 0) {
      if (v.yes / total > 0.5)  status = 'promoted'
      else if (v.no  / total >= 0.5) status = 'dismissed'
    }
    return { ...c, yes_votes: v.yes, no_votes: v.no, status }
  })
}

export async function getDigestSubscribers(): Promise<DigestSubscriber[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('users')
    .select('id, name, role, telegram_chat_id, digest_subscriber')
    .not('telegram_chat_id', 'is', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as DigestSubscriber[]
}

// ── API usage ──────────────────────────────────────────────────────────────────

export type UsageSummary = {
  service:          string
  call_count:       number
  total_tokens_in:  number
  total_tokens_out: number
  estimated_cost:   number
}

export type UnusualEvent = {
  id:          string
  service:     string
  endpoint:    string
  ts:          string
  reason:      string
  ip_address:  string | null
  called_by:   string | null
  location?:   string
}

export async function getUsageSummary(days = 30): Promise<UsageSummary[]> {
  const db    = createServiceClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('api_usage_logs')
    .select('service, tokens_in, tokens_out, estimated_cost')
    .gte('ts', since)
  if (error) throw error

  const map = new Map<string, UsageSummary>()
  for (const row of data ?? []) {
    const cur = map.get(row.service) ?? {
      service: row.service, call_count: 0,
      total_tokens_in: 0, total_tokens_out: 0, estimated_cost: 0,
    }
    cur.call_count++
    cur.total_tokens_in  += row.tokens_in  ?? 0
    cur.total_tokens_out += row.tokens_out ?? 0
    cur.estimated_cost   += Number(row.estimated_cost ?? 0)
    map.set(row.service, cur)
  }
  return [...map.values()].sort((a, b) => b.estimated_cost - a.estimated_cost)
}

type GeoResult = { city: string; country: string; org: string; countryCode: string }

async function geolocate(ip: string): Promise<GeoResult | null> {
  // Skip private / loopback addresses
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|localhost)/.test(ip)) return null
  try {
    const res = await fetch(`https://ipinfo.io/${ip}/json`, {
      signal:  AbortSignal.timeout(4000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const geo = await res.json() as { city?: string; country?: string; org?: string }
    return {
      city:        geo.city        ?? 'Unknown city',
      country:     geo.country     ?? 'Unknown',
      countryCode: geo.country     ?? 'Unknown',
      org:         geo.org         ?? '',
    }
  } catch {
    return null
  }
}

function fmtLocation(g: GeoResult): string {
  const parts = [g.city, g.country].filter(s => s && s !== 'Unknown').join(', ')
  return g.org ? `${parts} · ${g.org}` : parts
}

export async function getUnusualActivity(days = 7): Promise<UnusualEvent[]> {
  const db    = createServiceClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('api_usage_logs')
    .select('id, service, endpoint, ts, ip_address, called_by')
    .gte('ts', since)
    .order('ts', { ascending: false })
    .limit(500)
  if (error) throw error

  const rows = data ?? []

  // Geolocate all unique non-null IPs in parallel
  const uniqueIps = [...new Set(rows.map(r => r.ip_address).filter(Boolean))] as string[]
  const geoResults = await Promise.all(uniqueIps.map(ip => geolocate(ip)))
  const geoMap = new Map<string, GeoResult | null>(
    uniqueIps.map((ip, i) => [ip, geoResults[i]]),
  )

  const events: UnusualEvent[] = []
  const seenNonSgIps = new Set<string>()

  for (const row of rows) {
    const sgt  = new Date(new Date(row.ts).getTime() + 8 * 60 * 60 * 1000)
    const hour = sgt.getUTCHours()
    const geo  = row.ip_address ? geoMap.get(row.ip_address) ?? null : null
    const location = geo ? fmtLocation(geo) : undefined

    // Rule 1: off-hours call (before 7 AM or after 10 PM SGT)
    if (hour < 7 || hour >= 22) {
      events.push({
        id: row.id, service: row.service, endpoint: row.endpoint, ts: row.ts,
        reason:     `Off-hours call at ${sgt.toUTCString().slice(17, 22)} SGT (before 7 AM or after 10 PM)`,
        ip_address: row.ip_address, called_by: row.called_by, location,
      })
    }

    // Rule 2: call from outside Singapore (one event per unique IP)
    if (geo && geo.countryCode !== 'SG' && row.ip_address && !seenNonSgIps.has(row.ip_address)) {
      seenNonSgIps.add(row.ip_address)
      events.push({
        id: `${row.id}-geo`, service: row.service, endpoint: row.endpoint, ts: row.ts,
        reason:     `Call from outside Singapore`,
        ip_address: row.ip_address, called_by: row.called_by, location,
      })
    }
  }

  return events.slice(0, 20)
}

// Shared helper — call from any API route to record usage. Never throws.
export async function logApiUsage(entry: {
  service:         string
  endpoint:        string
  called_by?:      string | null
  job_id?:         string | null
  tokens_in?:      number
  tokens_out?:     number
  estimated_cost?: number
  ip_address?:     string
  user_agent?:     string
}): Promise<void> {
  try {
    const db = createServiceClient()
    await db.from('api_usage_logs').insert(entry as never)
  } catch {
    // Never let logging errors surface to callers
  }
}

// ── System health ──────────────────────────────────────────────────────────────

export type HealthCheck = {
  label:   string
  status:  'ok' | 'warn' | 'error' | 'unknown'
  detail:  string
}

export async function getLastEventTime(kind: string): Promise<string | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('events')
    .select('ts')
    .eq('kind', kind)
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.ts ?? null
}
