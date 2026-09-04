// Pure reducer for the hands-free loop. The hook owns the side effects
// (start/stop recognition, speak, fetch); this owns WHEN. Key invariant:
// 'responding' ends only when streamDone AND speechDone — the SSE stream
// and the TTS queue drain in either order.
export type VoicePhase = 'listening' | 'responding' | 'muted' | 'tapToTalk'

export interface VoiceState {
  phase:      VoicePhase
  streamDone: boolean
  speechDone: boolean
  restarts:   number
  // Where to return after a reply finishes ('muted' returns to muted, the
  // degraded mode returns to tapToTalk, normal flow to listening).
  home:       'listening' | 'muted' | 'tapToTalk'
}

export type VoiceEvent =
  | { type: 'utteranceReady' }
  | { type: 'streamEnded' }
  | { type: 'speechDrained' }
  | { type: 'recEnded' }
  | { type: 'recFatal' }
  | { type: 'mute' }
  | { type: 'unmute' }

export const MAX_RESTARTS = 3

export const initialVoiceState: VoiceState = {
  phase: 'listening', streamDone: false, speechDone: false, restarts: 0, home: 'listening',
}

function settle(s: VoiceState): VoiceState {
  if (s.phase === 'responding' && s.streamDone && s.speechDone) return { ...s, phase: s.home }
  return s
}

export function voiceReducer(s: VoiceState, e: VoiceEvent): VoiceState {
  switch (e.type) {
    case 'utteranceReady':
      // 'muted' is included for the keyboard path — a typed message may send
      // while the mic is off; the reply plays, then home returns us to muted.
      if (s.phase === 'responding') return s
      return { ...s, phase: 'responding', streamDone: false, speechDone: false, restarts: 0 }
    case 'streamEnded':
      return settle({ ...s, streamDone: true })
    case 'speechDrained':
      return settle({ ...s, speechDone: true })
    case 'recEnded': {
      // Only meaningful while we WANT the mic on; during 'responding' we
      // stopped it ourselves. Chrome ends continuous recognition ~60s idle
      // and on network blips — budget MAX_RESTARTS before degrading.
      if (s.phase !== 'listening') return s
      const restarts = s.restarts + 1
      if (restarts >= MAX_RESTARTS) return { ...s, phase: 'tapToTalk', home: 'tapToTalk', restarts: MAX_RESTARTS }
      return { ...s, restarts }
    }
    case 'recFatal':
      return { ...s, phase: s.phase === 'responding' ? 'responding' : 'tapToTalk', home: 'tapToTalk' }
    case 'mute':
      return { ...s, phase: s.phase === 'responding' ? 'responding' : 'muted', home: 'muted' }
    case 'unmute':
      return { ...s, phase: s.phase === 'responding' ? 'responding' : 'listening', home: 'listening', restarts: 0 }
  }
}
