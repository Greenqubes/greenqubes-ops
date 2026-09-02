# Workflow V3 Round 1 — Smoke-Test Feedback Log

> Nic's mid-test edits, logged as they come in (Design Load pattern). Each
> item gets fixed, committed, and pushed for incremental re-test on the
> `feat-workflow-v3` preview.

| # | Reported | Item | Status |
|---|---|---|---|
| 1 | 2026-09-02 | "+ New job in this project" navigates away and loses unsaved project edits — the project must autosave before the jump. | Fixed — edit-mode labels PATCH before the navigation; a failed save shows the error toast and stays put. |
