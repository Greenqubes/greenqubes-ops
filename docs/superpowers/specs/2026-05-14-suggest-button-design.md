# Design: AI Suggest Button per Text Field

_2026-05-14_

---

## What it does

Adds a small "✦ Suggest" button to four text fields in the job form. When clicked, it sends the field's current text to Claude, which returns a grammar- and clarity-improved version. The suggestion appears in a preview box below the field — the user can Accept (swap the field content) or Dismiss (close without changing anything).

---

## Fields that get the button

| Field | Location |
|---|---|
| Project Title | CoreSection |
| Job Description | CoreSection |
| Notes | CoreSection |
| Production Instructions | ProductionReadySection |

Visible to sales and scheduler only. Installers see these fields as read-only, so the button is not shown to them.

---

## UX behaviour

- Button only appears when the field has text in it
- Clicking shows "loading…" while Claude processes
- Result appears in a box below the field with **Accept** and **Dismiss**
- Accept: replaces field content with the suggestion
- Dismiss: closes the box, field unchanged
- Only one field can be in the suggesting state at a time

---

## The "brain" (API route)

New route: `POST /api/ai/suggest`

Receives `{ field: string, value: string }`, returns `{ suggestion: string }`.

A `SUGGEST_CONFIG` const at the top of the file controls style and model — one line to change without touching any logic:

```ts
const SUGGEST_CONFIG = {
  model: 'claude-haiku-4-5-20251001',
  style: 'Fix grammar and clarity. Keep the original meaning and tone.',
  // future: enableRag: false
}
```

The `field` name is passed into the prompt so Claude knows context (e.g. "this is a Project Title" vs "Production Instructions"). Structure leaves a clear hook to add RAG context in the future.

Checks Supabase session (standard auth, same as all other routes). Logs usage via `logApiUsage`.

---

## New files

- `src/app/api/ai/suggest/route.ts` — API route
- `src/components/SuggestField.tsx` — wrapper component

## Files changed

- `src/features/job-detail/CoreSection.tsx` — wrap Project Title, Description, Notes with SuggestField
- `src/features/job-detail/ProductionReadySection.tsx` — wrap Production Instructions with SuggestField
