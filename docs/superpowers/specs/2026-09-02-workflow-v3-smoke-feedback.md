# Workflow V3 Round 1 — Smoke-Test Feedback Log

> Nic's mid-test edits, logged as they come in (Design Load pattern). Each
> item gets fixed, committed, and pushed for incremental re-test on the
> `feat-workflow-v3` preview.

| # | Reported | Item | Status |
|---|---|---|---|
| 1 | 2026-09-02 | "+ New job in this project" navigates away and loses unsaved project edits — the project must autosave before the jump. | Fixed — edit-mode labels PATCH before the navigation; a failed save shows the error toast and stays put. |
| 2 | 2026-09-02 | Project collapsible folder doesn't appear on the schedule list. | Not a round-1 bug — schedule folding is round 2's headline (spec §13); logged so it stays visible. Round 2 starts on Nic's call. |
| 3 | 2026-09-02 | Creating a job inside a not-yet-pushed project needs an informational prompt: Save as pending keeps it pending inside the folder until the project is pushed; Push to Schedule from the job form supersedes and goes onto the schedule immediately (existing behaviour, just unexplained). | Fixed — amber notice under the New Job heading (en + zh), shown only while the project has no scheduled jobs yet. |
| 4 | 2026-09-02 | Project push (pushing #2): clashing jobs are held with no override — needs a "Push Anyways" button in the project clash/held flow too; Nic got soft-locked. | HELD on Nic's instruction ("hold on to the changes") — design sketch: held rows in the push result sheet gain a Push Anyways action (and/or the bulk flow reuses the job clash modal's override), pushing the job despite the clash exactly like the job form's Push Anyways. Build on Nic's go. |
