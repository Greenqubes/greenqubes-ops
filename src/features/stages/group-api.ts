import type { GroupBody } from '@/lib/utils/job-groups'

/** Send one Jobs tab group change to /api/job-groups. A network failure
 *  reads as { ok: false }; the caller shows the error toast. */
export async function postGroupChange(body: GroupBody): Promise<{ ok: boolean; groupId?: string }> {
  try {
    const res = await fetch('/api/job-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { ok: false }
    const data = await res.json().catch(() => null) as { groupId?: string } | null
    return { ok: true, ...(data?.groupId ? { groupId: data.groupId } : {}) }
  } catch {
    return { ok: false }
  }
}
