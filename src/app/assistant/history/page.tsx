import { redirect } from 'next/navigation'

// The phone history screen was replaced by the in-page drawer on /assistant
// (assistant upgrade Phase 1). The route stays as a redirect for old links.
export default function AssistantHistoryPage() {
  redirect('/assistant')
}
