/**
 * Standalone test for voice language mapping.
 * Run: npx tsx src/features/voice/voiceLang.test.ts
 * Exits 1 on any failure.
 */
import { speechLangTag, pickVoice, type SpeakableVoice } from './voiceLang'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); failures++ }
}

// Same mapping as the composer dictation mic (AssistantShell): zh → zh-CN,
// everything else (en AND bn — Bengali voice is out of scope v1) → en-SG.
check('zh maps to zh-CN', speechLangTag('zh'), 'zh-CN')
check('en maps to en-SG', speechLangTag('en'), 'en-SG')
check('bn falls back to en-SG', speechLangTag('bn'), 'en-SG')

const voices: SpeakableVoice[] = [
  { name: 'Google US English',    lang: 'en-US', localService: false },
  { name: 'Samantha',             lang: 'en-US', localService: true },
  { name: 'Google 普通话（中国大陆）', lang: 'zh-CN', localService: false },
  { name: 'Ting-Ting',            lang: 'zh-CN', localService: true },
  { name: 'en-SG-remote',         lang: 'en-SG', localService: false },
]
// Exact tag beats prefix match; local beats remote within the same tier.
check('exact tag wins', pickVoice(voices, 'en-SG')?.name, 'en-SG-remote')
check('prefix fallback prefers local', pickVoice(voices, 'en-GB')?.name, 'Samantha')
check('zh exact + local', pickVoice(voices, 'zh-CN')?.name, 'Ting-Ting')
check('underscore lang tags match', pickVoice([{ name: 'x', lang: 'zh_CN', localService: true }], 'zh-CN')?.name, 'x')
check('no match returns null', pickVoice(voices, 'ta-IN'), null)
check('empty list returns null', pickVoice([], 'en-SG'), null)

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll voiceLang checks passed')
