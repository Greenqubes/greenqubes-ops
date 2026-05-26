# feat-jobs — Session Note
_2026-05-14_

---

## What was done

### AI Suggest button on job form text fields

Added a "✦ Suggest" button to four text fields in the job form. When clicked, it sends the field's text to Claude, which returns a grammar- and clarity-improved version. The suggestion appears in a preview box below the field — the user can Accept (replace the field) or Dismiss (close without changing anything).

#### Fields with Suggest button

- Project Title
- Job Description
- Notes
- Production Instructions

Button only appears when the field has text. Not shown for installers (their fields are read-only). Not shown on completed jobs.

#### New files

**`src/app/api/ai/suggest/route.ts`**
The "brain" behind the button. Sends the field text to Claude (Haiku model — fast and cheap). A `SUGGEST_CONFIG` object at the top of the file lets you change how Claude polishes text in one line, without touching anything else. Returns the improved text as plain JSON.

**`src/components/SuggestField.tsx`**
The button wrapper. Drop it around any text field to add the Suggest button. Handles loading state and the Accept/Dismiss preview box internally.

#### Files changed

- `src/features/job-detail/CoreSection.tsx` — Project Title, Description, Notes wrapped with SuggestField
- `src/features/job-detail/ProductionReadySection.tsx` — Production Instructions wrapped with SuggestField
- `src/features/job-detail/JobDetailShell.tsx` — passes watch + setValue down to both sections
- `src/features/job-detail/NewJobShell.tsx` — same

### Plain language rule

Added a "Communication style" section to `CLAUDE.md` instructing Claude to always explain in plain, everyday language without coding terms. Also saved to memory so it applies across all future sessions.

---

## What's next

- Fix AdminRoleModal double-Yes bug (UsersTab — "Yes" requires two presses)
- Voice note: live audio waveform while recording
- Scheduler tab: Send Back on scheduled jobs
- Scheduler tab: Delete job
- Sales tab: Recall Job
- Sales tab: pre-send popup showing scheduler load
