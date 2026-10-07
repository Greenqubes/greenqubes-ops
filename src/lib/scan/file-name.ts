// "Signed DO - <job title> - 25 Sep 2026.pdf" (Nic, 2026-10-06). English
// month names always — CLAUDE.md hard rule. Pure.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function scanFileName(jobTitle: string | null | undefined, date: Date): string {
  const day = `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  const clean = (jobTitle ?? '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim()
  return clean ? `Signed DO - ${clean} - ${day}.pdf` : `Signed DO - ${day}.pdf`
}
