import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export type LiveTableSpec = {
  table:   string
  event?:  'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
}

export type LivePayload = {
  table:     string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new:       Record<string, unknown> | null
  old:       Record<string, unknown> | null
}

type Options = {
  name:    string
  tables:  LiveTableSpec[]
  onEvent: (payload: LivePayload) => void
  poll?:   { ms: number; fn: () => void }
}

// One place for the realtime subscribe dance. The setAuth step is load-bearing:
// RLS delivers postgres_changes events to authenticated listeners only, and
// omitting it (as two hand-copies of this code once did) silently kills the
// channel — no error, no events.
export function useLiveChannel({ name, tables, onEvent, poll }: Options) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const pollFnRef = useRef(poll?.fn)
  pollFnRef.current = poll?.fn

  // Callers pass `tables` as an inline literal; key on its content, not its
  // identity, so the channel doesn't tear down every render.
  const tablesKey = JSON.stringify(tables)
  const pollMs = poll?.ms

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let active = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      let ch = supabase.channel(name)
      for (const spec of JSON.parse(tablesKey) as LiveTableSpec[]) {
        ch = ch.on(
          'postgres_changes',
          { event: spec.event ?? '*', schema: 'public', table: spec.table, filter: spec.filter },
          payload => onEventRef.current({
            table:     payload.table,
            eventType: payload.eventType,
            new:       (payload.new ?? null) as LivePayload['new'],
            old:       (payload.old ?? null) as LivePayload['old'],
          }),
        )
      }
      channel = ch.subscribe()
    })

    const timer = pollMs ? setInterval(() => pollFnRef.current?.(), pollMs) : null
    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
      if (timer) clearInterval(timer)
    }
  }, [name, tablesKey, pollMs])
}
