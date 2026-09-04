// Accumulates SSE text deltas and emits complete sentences so speech can
// start before the stream finishes. Latin enders (. ! ?) count only when
// followed by whitespace/end-of-buffer — this keeps decimals ("2.5") and
// times intact; CJK enders (。！？) and newlines are boundaries on their own.
export function createSentenceChunker(): { push(delta: string): string[]; flush(): string | null } {
  let buffer = ''

  function extract(): string[] {
    const out: string[] = []
    // Walk the buffer for the earliest boundary each pass.
    for (;;) {
      let cut = -1
      for (let i = 0; i < buffer.length; i++) {
        const ch = buffer[i]
        if (ch === '\n' || ch === '。' || ch === '！' || ch === '？') { cut = i; break }
        if ((ch === '.' || ch === '!' || ch === '?') &&
            (i + 1 < buffer.length) && /\s/.test(buffer[i + 1])) { cut = i; break }
      }
      if (cut === -1) break
      const sentence = buffer.slice(0, cut + 1).trim()
      buffer = buffer.slice(cut + 1)
      if (sentence) out.push(sentence)
    }
    return out
  }

  return {
    push(delta: string): string[] {
      buffer += delta
      return extract()
    },
    flush(): string | null {
      const tail = buffer.trim()
      buffer = ''
      return tail || null
    },
  }
}
