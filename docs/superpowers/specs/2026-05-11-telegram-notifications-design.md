# Telegram Notification Messages — Design Spec

_Written: 2026-05-11_

---

## Overview

Finalise all Telegram notification message templates in `src/lib/telegram/templates.ts`. All messages currently contain `[PLACEHOLDER]` copy. This spec defines the final copy, layout, and data requirements for each template.

---

## Design decisions

- **Tone:** Professional & structured — labelled fields, easy to scan at a glance
- **Format:** Telegram HTML mode (`<b>`, `<i>`, `<a href>`)
- **Language:** English only, regardless of recipient's language setting
- **Deep link:** Every job notification includes a `View in app →` link to the job detail page (`https://greenqubes-ops.vercel.app/jobs/[id]`)
- **Project Title:** Rendered in bold above the Client field on every job notification (uses `project_title` from the jobs table, migration 0012)

---

## Job notifications

### 1. Submitted for approval
**Recipient:** Scheduler  
**Trigger:** Sales submits a job for scheduler approval

```
📋 Job Approval Requested
[Project Title]
Client: [jobClient]
Date: [jobDate], [timeStart] – [timeEnd]
Submitted by: [salesName]

View in app →
```

**New param needed:** `projectTitle`

---

### 2. Job approved
**Recipient:** Sales POC  
**Trigger:** Scheduler approves a job

```
✅ Job Approved
[Project Title]
Client: [jobClient]
Date: [jobDate], [timeStart] – [timeEnd]
Approved by: [schedulerName]

View in app →
```

**New params needed:** `projectTitle`, `timeStart`, `timeEnd`

---

### 3. Job sent back
**Recipient:** Sales POC  
**Trigger:** Scheduler sends a job back for revision

```
↩️ Job Sent Back
[Project Title]
Client: [jobClient]
Date: [jobDate]
Sent back by: [schedulerName]
Sent at: [sentAt]
Note: "[note]"   ← omitted if no note

View in app →
```

**New params needed:** `projectTitle`, `schedulerName`, `sentAt`  
**Note:** `note` remains optional

---

### 4. Job overdue
**Recipient:** Scheduler + Sales POC  
**Trigger:** Overdue cron — job is past its scheduled end time

```
⏰ Job Overdue
[Project Title]
Client: [jobClient]
Date: [jobDate]
Scheduled until: [timeEnd]
📍 [location]

View in app →
```

**New param needed:** `projectTitle`

---

### 5. New chat message
**Recipient:** Sales POC + all assigned installers on that job  
**Trigger:** Any user posts a text message in a job's chat thread

```
💬 New Message
[Project Title]
Client: [jobClient]
Date: [jobDate]
From: [authorName]
Sent at: [sentAt]
"[preview]"

View in app →
```

**New params needed:** `projectTitle`, `sentAt`  
**Routing change:** Currently sent only to sales POC — must also be sent to all assigned installers (look up `job_assignees` for the job)

---

### 6. Voice note
**Recipient:** Sales POC + all assigned installers on that job  
**Trigger:** Any user posts a voice note in a job's chat thread

```
🎤 Voice Note
[Project Title]
Client: [jobClient]
Date: [jobDate]
From: [authorName]
Sent at: [sentAt]

View in app →
```

**New params needed:** `projectTitle`, `sentAt`  
**Routing change:** Same as chat message — add assigned installers as recipients

---

## Monday digest

### 7. Digest header
**Recipient:** All digest subscribers  
**Trigger:** Every Monday at 9 AM SGT, sent once before the item messages

```
📊 Monday Digest — week of [weekOf]
───────────────────────────────
[count] important conversation(s) from last week.
Review each below and vote to promote to the knowledge base.
```

---

### 8. Digest item
**Recipient:** All digest subscribers  
**Trigger:** One message per conversation with `importance >= 4`, sent immediately after the header

```
[index]. [topic]
★★★★★  (filled stars = importance, hollow = remainder)
[date]
───────────────────────────────
[summary]
───────────────────────────────
Promote this to the knowledge base?
[✓ Yes]  [✗ No]   ← inline keyboard buttons
```

---

### 9. Vote status (message edit)
**Trigger:** Each time a subscriber votes, the original item message is edited in-place

**Pending:**
```
[same header + summary]
───────────────────────────────
📊 [yesCount] Yes · [noCount] No · [awaiting] awaiting ([totalVoters] voters)
```

**Promoted (majority Yes):**
```
[same header + summary]
───────────────────────────────
✅ Promoted — added to knowledge base.
```

**Dismissed (majority No):**
```
[same header + summary]
───────────────────────────────
❌ Dismissed — skipped.
```

---

## Bug report (no change)

`tplBugReport` is already fully designed and not marked as placeholder. No changes needed.

---

## Implementation scope

### `src/lib/telegram/templates.ts`
- Remove all `[PLACEHOLDER]` markers
- Update copy to match this spec
- Add new params to each template function signature:
  - `projectTitle: string` to all job templates
  - `sentAt: string` to `tplJobMessage`, `tplJobVoiceNote`, `tplJobSentBack`
  - `schedulerName: string` to `tplJobSentBack`
  - `timeStart: string`, `timeEnd: string` to `tplJobApproved` and `tplJobSubmittedForApproval`
  - `jobUrl: string` to all job templates (the deep link)

### Callers to update
Each template is called from an API route or script. All callers must be updated to pass the new params:
- `src/app/api/notifications/overdue/route.ts`
- `src/app/api/approvals/approve/route.ts` (or wherever approve/send-back triggers fire)
- Chat message / voice note send routes
- `scripts/monday-digest.ts` / `src/lib/digest/run.ts`

### Routing change
- `tplJobMessage` and `tplJobVoiceNote` callers must query `job_assignees` and send to each assigned installer's `telegram_chat_id` in addition to the sales POC.
