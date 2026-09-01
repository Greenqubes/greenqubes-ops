// Two-stage brief requirement (spec, Nic 2026-08-18): first push / pre-booking
// is exempt; after that, every edit-save on a scheduled job with a designer
// assigned requires brief TEXT (attachments never satisfy or trigger it).
export function briefRequiredError(input: {
  isNewJob:      boolean
  status:        string
  designerCount: number
  briefText:     string
}): boolean {
  if (input.isNewJob) return false
  if (input.status !== 'scheduled') return false
  if (input.designerCount === 0) return false
  return input.briefText.trim().length === 0
}
