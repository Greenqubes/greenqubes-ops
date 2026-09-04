/**
 * Standalone test for the voice conversation state machine.
 * Run: npx tsx src/features/voice/voiceMachine.test.ts
 * Exits 1 on any failure.
 */
import { voiceReducer, initialVoiceState, MAX_RESTARTS, type VoiceState, type VoiceEvent } from './voiceMachine'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); failures++ }
}
const run = (s: VoiceState, ...events: VoiceEvent[]) => events.reduce(voiceReducer, s)

check('starts listening', initialVoiceState.phase, 'listening')

// Happy path: speak → respond → back to listening only when BOTH the SSE
// stream AND the speech queue are done (order can vary).
const responding = run(initialVoiceState, { type: 'utteranceReady' })
check('utterance → responding', responding.phase, 'responding')
check('stream first, still responding', run(responding, { type: 'streamEnded' }).phase, 'responding')
check('stream then speech → listening', run(responding, { type: 'streamEnded' }, { type: 'speechDrained' }).phase, 'listening')
check('speech then stream → listening', run(responding, { type: 'speechDrained' }, { type: 'streamEnded' }).phase, 'listening')
check('round-trip resets flags', run(responding, { type: 'streamEnded' }, { type: 'speechDrained' }, { type: 'utteranceReady' }).streamDone, false)

// Restart budget: recEnded while listening increments; MAX_RESTARTS degrades.
let s = initialVoiceState
for (let i = 0; i < MAX_RESTARTS; i++) s = voiceReducer(s, { type: 'recEnded' })
check('exhausted restarts → tapToTalk', s.phase, 'tapToTalk')
check('restart count capped at degrade', s.restarts, MAX_RESTARTS)
check('successful turn resets restarts', run(run(initialVoiceState, { type: 'recEnded' }), { type: 'utteranceReady' }).restarts, 0)

// recEnded while responding is normal (we stopped the mic ourselves) — no-op.
check('recEnded while responding ignored', run(responding, { type: 'recEnded' }).restarts, 0)

// Fatal recognition error degrades immediately (unless mid-reply — then the
// reply finishes and lands in tapToTalk via home).
check('recFatal degrades', run(initialVoiceState, { type: 'recFatal' }).phase, 'tapToTalk')
check('recFatal mid-reply finishes reply first', run(responding, { type: 'recFatal' }).phase, 'responding')
check('recFatal mid-reply lands tapToTalk', run(responding, { type: 'recFatal' }, { type: 'streamEnded' }, { type: 'speechDrained' }).phase, 'tapToTalk')

// Mute/unmute.
check('mute from listening', run(initialVoiceState, { type: 'mute' }).phase, 'muted')
check('unmute resumes listening', run(initialVoiceState, { type: 'mute' }, { type: 'unmute' }).phase, 'listening')
check('unmute resets restarts', run(run(initialVoiceState, { type: 'recEnded' }), { type: 'mute' }, { type: 'unmute' }).restarts, 0)
check('mute while responding keeps reply going', run(responding, { type: 'mute' }).phase, 'responding')
check('after reply, lands muted', run(responding, { type: 'mute' }, { type: 'streamEnded' }, { type: 'speechDrained' }).phase, 'muted')

// Muted still allows a TYPED message (the keyboard path) — reply plays, then
// back to muted with the mic still off.
const mutedSend = run(initialVoiceState, { type: 'mute' }, { type: 'utteranceReady' })
check('typed send allowed while muted', mutedSend.phase, 'responding')
check('muted send returns to muted', run(mutedSend, { type: 'streamEnded' }, { type: 'speechDrained' }).phase, 'muted')

// tapToTalk: an utterance still sends and returns to tapToTalk after the reply.
const tapSend = run(s, { type: 'utteranceReady' })
check('tapToTalk can send', tapSend.phase, 'responding')
check('reply returns to tapToTalk', run(tapSend, { type: 'streamEnded' }, { type: 'speechDrained' }).phase, 'tapToTalk')

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll voiceMachine checks passed')
