'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { speechLangTag, pickVoice } from './voiceLang'
import { toSpeakable } from './speakable'
import { createSentenceChunker } from './sentenceChunker'
import { voiceReducer, initialVoiceState, type VoicePhase } from './voiceMachine'
import type { LangCode } from '@/lib/i18n'

// ── Web Speech typings (lib.dom has none for recognition) ───────────────────
// Richer than AssistantShell's dictation typings: voice mode needs isFinal
// per result and the error code to tell permission problems from blips.

interface RecognitionResultLike { 0: { transcript: string }; isFinal: boolean }
interface RecognitionEventLike { resultIndex: number; results: ArrayLike<RecognitionResultLike> }
interface RecognitionErrorLike { error?: string }
interface SpeechRecognitionLike {
  lang:           string
  continuous:     boolean
  interimResults: boolean
  onresult: ((e: RecognitionEventLike) => void) | null
  onend:    (() => void) | null
  onerror:  ((e: RecognitionErrorLike) => void) | null
  start(): void
  stop():  void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?:       SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// A final recognition result followed by this much silence ends the turn.
const SILENCE_MS = 1200

export interface VoiceTurn {
  id:       string
  role:     'user' | 'assistant'
  content:  string
  jobCard?: { id: string; title: string | null }
}

function uid() {
  return Math.random().toString(36).slice(2)
}

export function useVoiceSession(lang: LangCode) {
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState)
  const [supported,      setSupported]      = useState({ stt: true, tts: true })
  const [micDenied,      setMicDenied]      = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [turns,          setTurns]          = useState<VoiceTurn[]>([])
  const [streamingText,  setStreamingText]  = useState('')
  const [statusKey,      setStatusKey]      = useState<string | undefined>()
  const [errorKey,       setErrorKey]       = useState<'voiceError' | null>(null)
  const [isSpeaking,     setIsSpeaking]     = useState(false)

  const startedRef        = useRef(false)
  const shutdownRef       = useRef(false)
  const phaseRef          = useRef<VoicePhase>(state.phase)
  const turnsRef          = useRef<VoiceTurn[]>([])
  const recognitionRef    = useRef<SpeechRecognitionLike | null>(null)
  const abortRef          = useRef<AbortController | null>(null)
  const silenceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptRef     = useRef('')
  const utterancesLeftRef = useRef(0)
  const streamEndedRef    = useRef(true)
  const ttsOkRef          = useRef(false)
  const voicesRef         = useRef<SpeechSynthesisVoice[]>([])

  phaseRef.current = state.phase

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
  }

  // Detach handlers BEFORE stopping so the mic going quiet on purpose never
  // looks like a crash to the restart budget.
  const stopRecognition = useCallback(() => {
    clearSilenceTimer()
    const rec = recognitionRef.current
    if (!rec) return
    recognitionRef.current = null
    rec.onresult = null
    rec.onend    = null
    rec.onerror  = null
    try { rec.stop() } catch { /* already stopped */ }
  }, [])

  const speak = useCallback((raw: string) => {
    const text = toSpeakable(raw)
    if (!text || !ttsOkRef.current) return
    const u   = new SpeechSynthesisUtterance(text)
    const tag = speechLangTag(lang)
    u.lang = tag
    const picked = pickVoice(
      voicesRef.current.map(v => ({ name: v.name, lang: v.lang, localService: v.localService })),
      tag,
    )
    if (picked) {
      const real = voicesRef.current.find(v => v.name === picked.name && v.lang === picked.lang)
      if (real) u.voice = real
    }
    utterancesLeftRef.current += 1
    setIsSpeaking(true)
    const done = () => {
      utterancesLeftRef.current = Math.max(0, utterancesLeftRef.current - 1)
      if (utterancesLeftRef.current === 0) {
        setIsSpeaking(false)
        if (streamEndedRef.current) dispatch({ type: 'speechDrained' })
      }
    }
    u.onend   = done
    u.onerror = done
    window.speechSynthesis.speak(u)
  }, [lang])

  const streamTurn = useCallback(async (history: { role: 'user' | 'assistant'; content: string }[]) => {
    const controller = new AbortController()
    abortRef.current = controller
    streamEndedRef.current = false

    const chunker = createSentenceChunker()
    let streamed = ''
    let jobCard: VoiceTurn['jobCard']

    const finishStream = () => {
      const tail = chunker.flush()
      if (tail) speak(tail)
      if (streamed || jobCard) {
        const asst: VoiceTurn = { id: uid(), role: 'assistant', content: streamed, ...(jobCard ? { jobCard } : {}) }
        turnsRef.current = [...turnsRef.current, asst]
        setTurns(turnsRef.current)
      }
      setStreamingText('')
      setStatusKey(undefined)
      streamEndedRef.current = true
      dispatch({ type: 'streamEnded' })
      if (utterancesLeftRef.current === 0) dispatch({ type: 'speechDrained' })
    }

    try {
      const res = await fetch('/api/assistant/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history, voice: true }),
        signal:  controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

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
          let payload: { type: string; text?: string; key?: string; id?: string; title?: string | null }
          try { payload = JSON.parse(raw) } catch { continue }

          if (payload.type === 'text' && payload.text) {
            streamed += payload.text
            setStreamingText(streamed)
            setStatusKey(undefined)
            for (const sentence of chunker.push(payload.text)) speak(sentence)
          } else if (payload.type === 'status' && payload.key) {
            setStatusKey(payload.key)
          } else if (payload.type === 'job_created' && payload.id) {
            jobCard = { id: payload.id, title: payload.title ?? null }
          } else if (payload.type === 'error') {
            setErrorKey('voiceError')
          }
          // 'sources' are link chips — nothing to speak; 'done' is implied by
          // the reader closing (matches both existing chat clients).
        }
      }
      finishStream()
    } catch (err) {
      const aborted = controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')
      if (!aborted) setErrorKey('voiceError')
      finishStream()
    } finally {
      abortRef.current = null
    }
  }, [speak])

  const sendUtterance = useCallback((text: string) => {
    const clean = text.trim()
    if (!clean) return
    if (phaseRef.current !== 'listening' && phaseRef.current !== 'tapToTalk') return
    stopRecognition()
    setErrorKey(null)
    setLiveTranscript('')
    transcriptRef.current = ''
    const userTurn: VoiceTurn = { id: uid(), role: 'user', content: clean }
    turnsRef.current = [...turnsRef.current, userTurn]
    setTurns(turnsRef.current)
    dispatch({ type: 'utteranceReady' })
    void streamTurn(turnsRef.current.map(t => ({ role: t.role, content: t.content })))
  }, [stopRecognition, streamTurn])

  const startRecognition = useCallback((oneShot: boolean) => {
    if (recognitionRef.current) return
    const Ctor = getSpeechRecognition()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang           = speechLangTag(lang)
    rec.continuous     = !oneShot
    rec.interimResults = true

    // resultIndex-aware accumulation (the canonical Web Speech pattern).
    // Rebuilding from the WHOLE results list — the first version — duplicates
    // words on Android Chrome, which re-emits earlier fragments in later
    // events ("arrange arrange a job"). Finals are appended exactly once;
    // interims only ever replace the tail. Android also re-sends the same
    // final segment verbatim sometimes, hence the lastFinal guard.
    let finals    = ''
    let lastFinal = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const text = r[0].transcript.replace(/\s+/g, ' ').trim()
        if (!text) continue
        if (r.isFinal) {
          if (text === lastFinal) continue
          lastFinal = text
          finals = finals ? `${finals} ${text}` : text
        } else {
          interim = interim ? `${interim} ${text}` : text
        }
      }
      const combined = interim ? `${finals} ${interim}`.trim() : finals
      transcriptRef.current = combined
      setLiveTranscript(combined)
      clearSilenceTimer()
      const last = e.results[e.results.length - 1]
      if (!last?.isFinal) return
      if (oneShot) {
        sendUtterance(combined)
      } else {
        // Hands-free: a final result starts the silence countdown; any
        // further speech (a new result event) cancels and re-arms it.
        silenceTimerRef.current = setTimeout(() => sendUtterance(transcriptRef.current), SILENCE_MS)
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMicDenied(true)
        recognitionRef.current = null
        dispatch({ type: 'recFatal' })
      }
      // Everything else ('no-speech', 'network', 'aborted') falls through to
      // onend, which charges the restart budget.
    }
    rec.onend = () => {
      if (recognitionRef.current !== rec) return // we stopped it ourselves
      recognitionRef.current = null
      if (shutdownRef.current) return
      if (phaseRef.current === 'listening') dispatch({ type: 'recEnded' })
    }

    recognitionRef.current = rec
    try { rec.start() } catch {
      recognitionRef.current = null
      dispatch({ type: 'recEnded' })
    }
  }, [lang, sendUtterance])

  // Phase drives the mic. `restarts` is in the deps so a recEnded that keeps
  // us in 'listening' re-runs this effect and restarts recognition.
  useEffect(() => {
    if (!startedRef.current || shutdownRef.current) return
    if (state.phase === 'listening' && supported.stt && !micDenied) {
      startRecognition(false) // continuous mode
    } else if (state.phase !== 'listening') {
      stopRecognition()
      setLiveTranscript('')
      transcriptRef.current = ''
    }
  }, [state.phase, state.restarts, supported.stt, micDenied, startRecognition, stopRecognition])

  const start = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    const stt = getSpeechRecognition() !== null
    const tts = typeof window !== 'undefined' && 'speechSynthesis' in window
    ttsOkRef.current = tts
    setSupported({ stt, tts })
    if (tts) {
      // iOS requires a user-gesture utterance before any speech plays; the
      // FAB tap that mounted the overlay is still the active gesture here.
      try { window.speechSynthesis.speak(new SpeechSynthesisUtterance('')) } catch { /* non-fatal */ }
      const loadVoices = () => { voicesRef.current = window.speechSynthesis.getVoices() }
      loadVoices()
      if (voicesRef.current.length === 0) window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    }
    if (stt) startRecognition(false)
  }, [startRecognition])

  const shutdown = useCallback(() => {
    if (shutdownRef.current) return
    shutdownRef.current = true
    abortRef.current?.abort()
    stopRecognition()
    try { window.speechSynthesis?.cancel() } catch { /* no TTS */ }
    // Voice chats save exactly like floating-panel chats — history, memory
    // and the tagger all work unchanged (spec §3.4).
    const payload = turnsRef.current.map(({ role, content, jobCard }) => ({
      role, content, ...(jobCard ? { jobCard } : {}),
    }))
    if (payload.length >= 2) {
      try {
        void fetch('/api/assistant/save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          keepalive: true, body: JSON.stringify({ messages: payload }),
        })
      } catch { /* best-effort */ }
    }
  }, [stopRecognition])

  useEffect(() => {
    return () => { shutdown() }
  }, [shutdown])

  const mute    = useCallback(() => dispatch({ type: 'mute' }), [])
  const unmute  = useCallback(() => dispatch({ type: 'unmute' }), [])
  const tapTalk = useCallback(() => {
    if (phaseRef.current !== 'tapToTalk' || recognitionRef.current) return
    startRecognition(true) // one-shot
  }, [startRecognition])
  const sendTyped = useCallback((text: string) => sendUtterance(text), [sendUtterance])

  return {
    phase: state.phase,
    supported,
    micDenied,
    liveTranscript,
    turns,
    streamingText,
    statusKey,
    errorKey,
    isSpeaking,
    start,
    shutdown,
    mute,
    unmute,
    tapTalk,
    sendTyped,
  }
}
