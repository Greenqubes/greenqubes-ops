// Turns one chunk of assistant markdown into text a speech voice can read
// naturally. The voice-mode prompt asks the model for plain prose, but the
// model can still slip in markdown — this is the safety net, not the plan.
// Order matters: links before bare URLs, block markers before inline ones.
export function toSpeakable(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')             // images (drop entirely)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')          // links → label
    .replace(/https?:\/\/\S+/g, '')                   // bare URLs
    .replace(/^#{1,6}\s+/gm, '')                      // heading markers
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')        // bullet / numbered markers
    .replace(/^(?:-{3,}|_{3,}|\*{3,})\s*$/gm, '')     // horizontal rules
    .replace(/```[^`]*```/g, '')                      // fenced code blocks ([^`] spans newlines)
    .replace(/`([^`]*)`/g, '$1')                      // inline code → contents
    .replace(/(\*\*|__)(.*?)\1/g, '$2')               // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')                  // italic
    .replace(/^\s*\|(.+)\|\s*$/gm, (_, row: string) => // table row → "a, b"
      row.split('|').map(c => c.trim()).filter(c => c && !/^:?-+:?$/.test(c)).join(', '))
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '') // emoji + variation/joiner marks
    .replace(/\s+/g, ' ')
    .trim()
}
