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
- **Project title:** Rendered as a `<b>` line directly below the message type heading on every job notification. Uses `project_title` from the jobs table (migration 0012). No "Project:" label — bold alone distinguishes it.
- **POC fields:** Every job notification shows `POC: [name]` and `Contact: [phone]` below Client. Uses `client_poc_name` and `client_poc_phone` from the jobs table. Renders as `(NIL)` if empty.

---

## Job notifications

### 1. Submitted for approval
**Recipient:** Scheduler  
**Trigger:** Sales submits a job for scheduler approval

```
📋 Approval Requested
[project_title in bold]
Client: [jobClient]
POC: [client_poc_name | (NIL)]
Contact: [client_poc_phone | (NIL)]
Date: [jobDate], [timeStart] – [timeEnd]
Submitted by: [salesName]

View in app →
```

**New params:** `projectTitle`, `pocName`, `pocPhone`, `timeStart`, `timeEnd`, `jobUrl`

---

### 2. Job approved
**Recipient:** Sales POC  
**Trigger:** Scheduler approves a job

```
✅ Job Approved
[project_title in bold]
Client: [jobClient]
POC: [client_poc_name | (NIL)]
Contact: [client_poc_phone | (NIL)]
Date: [jobDate], [timeStart] – [timeEnd]
Approved by: [schedulerName]

View in app →
```

**New params:** `projectTitle`, `pocName`, `pocPhone`, `timeStart`, `timeEnd`, `jobUrl`

---

### 3. Job assigned
**Recipient:** All assigned installers on the job  
**Trigger:** Scheduler approves a job — fires in parallel with "Job Approved" sent to sales

```
📅 Job Assigned
[project_title in bold]
Client: [jobClient]
POC: [client_poc_name | (NIL)]
Contact: [client_poc_phone | (NIL)]
Date: [jobDate], [timeStart] – [timeEnd]
📍 [location]

View in app →
```

**New template:** `tplJobAssigned`  
**Params:** `projectTitle`, `jobClient`, `pocName`, `pocPhone`, `jobDate`, `timeStart`, `timeEnd`, `location`, `jobUrl`  
**Routing:** Query `job_assignees` and send to each installer's `telegram_chat_id`

---

### 4. Job sent back
**Recipient:** Sales POC  
**Trigger:** Scheduler sends a job back for revision

```
↩️ Job Sent Back
[project_title in bold]
Client: [jobClient]
POC: [client_poc_name | (NIL)]
Contact: [client_poc_phone | (NIL)]
Date: [jobDate]
Sent back by: [schedulerName]
Sent at: [sentAt]
Note: "[note]"   ← omitted if no note

View in app →
```

**New params:** `projectTitle`, `pocName`, `pocPhone`, `schedulerName`, `sentAt`, `jobUrl`  
**Note:** `note` remains optional

---

### 5. Job overdue
**Recipient:** Scheduler + Sales POC  
**Trigger:** Overdue cron — job is past its scheduled end time

```
⏰ Job Overdue
[project_title in bold]
Client: [jobClient]
POC: [client_poc_name | (NIL)]
Contact: [client_poc_phone | (NIL)]
Date: [jobDate]
Scheduled until: [timeEnd]
📍 [location]

View in app →
```

**New params:** `projectTitle`, `pocName`, `pocPhone`, `jobUrl`

---

### 6. New chat message
**Recipient:** Sales POC + all assigned installers on that job  
**Trigger:** Any user posts a text message in a job's chat thread

```
💬 New Message
[project_title in bold]
Client: [jobClient]
POC: [client_poc_name | (NIL)]
Contact: [client_poc_phone | (NIL)]
Date: [jobDate]
From: [authorName]
Sent at: [sentAt]
"[preview]"

View in app →
```

**New params:** `projectTitle`, `pocName`, `pocPhone`, `sentAt`, `jobUrl`  
**Routing change:** Currently sent only to sales POC — must also be sent to all assigned installers (query `job_assignees`)

---

### 7. Voice note
**Recipient:** Sales POC + all assigned installers on that job  
**Trigger:** Any user posts a voice note in a job's chat thread

```
🎤 Voice Note
[project_title in bold]
Client: [jobClient]
POC: [client_poc_name | (NIL)]
Contact: [client_poc_phone | (NIL)]
Date: [jobDate]
From: [authorName]
Sent at: [sentAt]

View in app →
```

**New params:** `projectTitle`, `pocName`, `pocPhone`, `sentAt`, `jobUrl`  
**Routing change:** Same as chat message — add assigned installers as recipients

---

## Monday digest

### 8. Digest header
**Recipient:** All digest subscribers  
**Trigger:** Every Monday at 9 AM SGT, sent once before the item messages

```
📊 Monday Digest — week of [weekOf]
───────────────────────────────
[count] important conversation(s) from last week.
Review each below and vote to promote to the knowledge base.
```

---

### 9. Digest item
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

### 10. Vote status (message edit)
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

## Bug report

**Recipient:** Admin via `greenqubes_bugs_bot` (`TELEGRAM_BUG_BOT_TOKEN` + `TELEGRAM_BUG_CHAT_ID`)  
**Trigger:** Any user submits a bug report

Priority emoji: 🚨 Urgent · 🔴 High · 🟡 Medium · 🟢 Low

```
[emoji] Bug Report — [PRIORITY]
───────────────────────────────
Reported by: [userEmail] ([userRole])
Time: [sgtTime]
Page: [route]
Platform: [platform] · [os]
───────────────────────────────
"[message]"
───────────────────────────────
View screenshot →    ← omitted if no screenshot
```

**Params (unchanged from existing):** `priority`, `sgtTime`, `platform`, `os`, `userEmail`, `userRole`, `route`, `message`, `screenshotUrl?`  
**Change from existing:** Remove `screen` and `ip` params — not useful in the notification (available in Admin → Bugs tab). Redesign copy to match professional & structured style with dividers. Screenshot link opens the Cloudflare R2 signed URL directly.

---

## Implementation scope

### `src/lib/telegram/templates.ts`
- Remove all `[PLACEHOLDER]` markers
- Update copy to match this spec
- Add new params to every job template: `projectTitle`, `pocName`, `pocPhone`, `jobUrl`
- Add `sentAt` to `tplJobMessage`, `tplJobVoiceNote`, `tplJobSentBack`
- Add `schedulerName` to `tplJobSentBack`
- Add `timeStart`, `timeEnd` to `tplJobApproved`, `tplJobSubmittedForApproval`, `tplJobAssigned`
- Add `location` to `tplJobAssigned`
- Add new function `tplJobAssigned`
- Remove `screen` and `ip` params from `tplBugReport`

### Callers to update
All callers must be updated to pass the new params. Fetch `project_title`, `client_poc_name`, `client_poc_phone` from the jobs table at the call site:
- `src/app/api/notifications/overdue/route.ts`
- Approve / send-back API route(s)
- Chat message / voice note send route(s)
- `scripts/monday-digest.ts` / `src/lib/digest/run.ts`

### Routing changes
- `tplJobMessage` and `tplJobVoiceNote` callers: query `job_assignees` and send to each assigned installer's `telegram_chat_id` in addition to the sales POC
- `tplJobAssigned` caller: query `job_assignees` and send to each installer — fired in parallel with `tplJobApproved` to sales
