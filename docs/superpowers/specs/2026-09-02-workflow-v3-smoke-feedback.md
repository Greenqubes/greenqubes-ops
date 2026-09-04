# Workflow V3 Round 1 — Smoke-Test Feedback Log

> ⛔ **Workflow V3 was cancelled 2026-09-04** — archive only. All five items
> below were fixed on this branch, which was never merged.

> Nic's mid-test edits, logged as they come in (Design Load pattern). Each
> item gets fixed, committed, and pushed for incremental re-test on the
> `feat-workflow-v3` preview.

| # | Reported | Item | Status |
|---|---|---|---|
| 1 | 2026-09-02 | "+ New job in this project" navigates away and loses unsaved project edits — the project must autosave before the jump. | Fixed — edit-mode labels PATCH before the navigation; a failed save shows the error toast and stays put. |
| 2 | 2026-09-02 | Project collapsible folder doesn't appear on the schedule list. | Not a round-1 bug — schedule folding is round 2's headline (spec §13); logged so it stays visible. Round 2 starts on Nic's call. |
| 3 | 2026-09-02 | Creating a job inside a not-yet-pushed project needs an informational prompt: Save as pending keeps it pending inside the folder until the project is pushed; Push to Schedule from the job form supersedes and goes onto the schedule immediately (existing behaviour, just unexplained). | Fixed — amber notice under the New Job heading (en + zh), shown only while the project has no scheduled jobs yet. |
| 4 | 2026-09-02 | Project push (pushing #2): clashing jobs are held with no override — Nic got soft-locked; direction: reuse the job form's clash feature. | Fixed — project push now opens the job form's own ClashResolutionModal per clashing job (substitutes, time shift, Notify Scheduler, keep/push anyway); clean + resolved jobs then push in ONE route call, so still one scheduler Telegram; skipped/notified jobs appear on the result sheet as kept pending. Time shifts route through timingOnJobTimeEdit so inheritance stays correct. |
| 5 | 2026-09-02 | Jobs created inside a project with nothing typed after the "{project} — " prefix end up titled "Name —". | Fixed — cheap guard: empty-after-prefix titles become "{project} — (Untitled X)" (X = nested-job count + 1). |
