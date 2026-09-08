import { createClient } from '@/lib/supabase/server'
import type { LeaveRecord } from '@/lib/utils/leave-overlap'

// ── Types ────────────────────────────────────────────────────────────────────

export type LeaveWithName = LeaveRecord & {
  user_name: string
  /** null for every role except hr/admin — RLS on user_leave_details. */
  details: { leave_type: string; note: string | null } | null
}

export type Holiday = { id: string; holiday_date: string; name: string }

type LeaveRow = LeaveRecord & {
  user_leave_details: { leave_type: string; note: string | null } | null
}

// ── Queries ──────────────────────────────────────────────────────────────────

// Every logged-in user may read WHO is away and WHEN (schedule display + clash
// checks). The details embed comes back null for everyone but hr/admin — that
// is RLS on user_leave_details doing it, not a filter here, so the reason for
// an absence never leaves the database for the wrong caller.
export async function getLeave(): Promise<LeaveWithName[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_leaves')
    .select('id, user_id, date_start, date_end, start_portion, end_portion, user_leave_details(leave_type, note)')
    .order('date_start', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as unknown as LeaveRow[]
  // Names via a follow-up query — user_leaves has two FKs to users
  // (user_id, created_by); embedding users would hit PGRST201 (standing rule).
  const ids = [...new Set(rows.map(r => r.user_id))]
  const nameById = new Map<string, string>()
  if (ids.length > 0) {
    type NameRow = { id: string; name: string }
    const { data: users } = await supabase.from('users').select('id, name').in('id', ids)
    for (const u of (users ?? []) as NameRow[]) nameById.set(u.id, u.name)
  }
  return rows.map(({ user_leave_details, ...r }) => ({
    ...r,
    user_name: nameById.get(r.user_id) ?? '',
    details: user_leave_details,
  }))
}

// Leave overlapping a date window — the clash surfaces pull only what they
// need rather than the whole table. Overlap test is inclusive on both ends:
// a leave counts if it starts on or before the window ends AND ends on or
// after the window starts.
export async function getLeaveInRange(from: string, to: string): Promise<LeaveRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_leaves')
    .select('id, user_id, date_start, date_end, start_portion, end_portion')
    .lte('date_start', to)
    .gte('date_end', from)
  if (error) throw error
  return (data ?? []) as unknown as LeaveRecord[]
}

export async function getHolidays(): Promise<Holiday[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('public_holidays')
    .select('id, holiday_date, name')
    .order('holiday_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Holiday[]
}

export async function getHolidaysInRange(from: string, to: string): Promise<Holiday[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('public_holidays')
    .select('id, holiday_date, name')
    .gte('holiday_date', from)
    .lte('holiday_date', to)
    .order('holiday_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Holiday[]
}

// The Leave form's person picker: every active internal user, ALL roles —
// leave applies to the whole team, support crew and drivers included.
export async function getActiveUsers(): Promise<Array<{ id: string; name: string; role: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role')
    .neq('name', 'GreenqubesAI')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Array<{ id: string; name: string; role: string }>
}
