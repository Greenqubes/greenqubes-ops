# infra-backup — Nightly Backup Was Never Running

_2026-08-12 · branch `dev` · server PC (GQS) configuration + `scripts/nightly-backup.bat`_

---

## The headline

**There was no backup.** Not a broken one — none at all.

`nic-checklist.md` had stated since May, under "Server PC — Already Set Up ✓", that a nightly backup ran at 02:00 syncing Cloudflare R2 to the local drive and dumping the database. That line was wrong. The rclone remote and the environment variable were configured back in May, and `backup.sh` was written and tested by hand once — but **the Task Scheduler entry was never created**, so nothing ever ran on a schedule.

Three months of job attachments, production photos and signed DOs existed **only** in Cloudflare R2, with no second copy anywhere.

Found by accident while checking for the task by name. Everything below follows from that.

---

## How it was confirmed

Not by trusting the absence of a task name, which could just mean a different name:

- Searched **all 380** scheduled tasks for anything invoking `.sh`, `bash`, or `rclone` → zero matches
- Nothing scheduled at 02:00 at all
- `E:\Greenqubes-Archive\db` and `\logs` both stopped dead at **7 May 2026** — 8 dumps and 9 logs, all from one afternoon of manual testing
- **`E:\Greenqubes-Archive\r2` contained 0 files**

That last point is the one that mattered. The 7 May log shows the R2 sync completing cleanly with `There was nothing to transfer` — correct at the time, because the bucket was empty. It has never run since, and the bucket has not been empty for months.

---

## What was built

### `scripts/nightly-backup.bat` (new)

A wrapper matching the existing `nightly-obsidian-sync.bat` pattern, rather than pointing the task at `bash.exe` with arguments — the quoting is fragile and the wrapper gives somewhere to catch early failures.

```bat
set PATH=C:\rclone;%PATH%
set BACKUP_ROOT=E:/Greenqubes-Archive
"C:\Git\bin\bash.exe" -c "/e/greenqubes-ops/scripts/backup.sh"
```

`backup.sh` writes its own timestamped log. The wrapper only catches failures that happen *before* that log exists — a missing env var, bash not found, the drive offline — appending them to `logs\wrapper-errors.log`. Without this, a failure at that stage leaves no trace at all, which is how this went unnoticed for three months.

### Task Scheduler entry

`Greenqubes Nightly Backup` — daily 02:00, runs as `GQAdmin`.

---

## Two bugs found while testing it

### 1. The direct database host is IPv6-only

First run: R2 sync succeeded (41 files, 15.3 MiB — the first R2 backup ever), then `pg_dump` failed.

`SUPABASE_DB_URL` pointed at `db.<ref>.supabase.co`. That hostname now resolves to **AAAA only** — no IPv4 record. This server PC has no IPv6 route, so it is simply unreachable:

```
pg_dump: error: could not translate host name "db.sotedopqyoondboareyp.supabase.co"
         to address: Name or service not known
```

`Test-NetConnection` to that host on 5432 confirms `TcpTestSucceeded: False`.

**Fix:** the IPv4 **session pooler**, `aws-1-ap-southeast-1.pooler.supabase.com:5432`, username `postgres.<ref>`.

> **Port matters.** 5432 is session mode and can dump. **6543 is transaction mode and cannot** — at one point the machine variable was set to 6543, which would have failed just as silently. If a dump ever breaks again, check the port first.

### 2. The stored password was stale

The pooler reached the server but rejected the password — almost certainly never updated after the rotation in Session 17.11. Nic reset it and supplied a fresh connection string.

**The reset takes 15–30 seconds to reach the pooler.** Both old and new passwords were rejected immediately after the reset, which looks exactly like a wrong password. Retrying 15 seconds later succeeded on the first attempt. Worth remembering — the obvious conclusion is the wrong one here.

---

## Then: making it run unattended

Both scheduled tasks were set to run only when a user is logged in. On a server PC sitting at the login screen overnight, neither would ever fire. A backup that silently skips nights is close to no backup at all.

Changed both to `LogonType: Password` / `RunLevel: Highest`.

Two things learned doing it:

- **The Task Scheduler GUI reverts silently.** Ticking "Run whether user is logged on or not" prompts for the account password on OK; if that prompt is cancelled or rejected, the dialog closes as though it saved and the setting quietly reverts. `Set-ScheduledTask` with `Get-Credential` from an elevated PowerShell is the reliable route.
- **`schtasks /query` reports the wrong thing.** Its `Logon Mode` field still reads `Interactive/Background` after the change succeeds. This caused a false "it didn't work" call during the session. The authoritative value is `(Get-ScheduledTask …).Principal.LogonType` — `Password` means logged-in-or-not.

Both tasks were then test-run rather than left until 02:00, because this change breaks things silently: a script that waits for input has no console to prompt at and hangs forever instead of failing. Backup finished in seconds; Obsidian sync took ~6 minutes (normal embedding workload — it briefly looked like a hang and was not).

---

## Final state

| | Backup | Obsidian Sync |
|---|---|---|
| Task name | `Greenqubes Nightly Backup` | `Greenqubes Obsidian Sync` |
| Schedule | daily 02:00 | daily 02:30 |
| Logon type | `Password` (unattended) | `Password` (unattended) |
| Run level | Highest | Highest |
| Last result | 0 | 0 |

Backup contents verified, not just assumed present:

- **R2** → 41 files, 15.3 MiB
- **DB** → ~205 KB gzipped / 819 KB raw; `gzip -t` clean; **22 tables** with **22 `COPY` data blocks**; ends with the `PostgreSQL database dump complete` marker
- DB dumps pruned after 30 days; R2 mirrors current state

---

## Still open

- **The old DB password may be live elsewhere** — Vercel env vars, Bryan's `.env.local`, other server scripts. Anything holding the pre-rotation value is broken now and will fail quietly. In `nic-checklist.md`.
- **`GQAdmin`'s Windows password is now stored in Task Scheduler.** If it ever changes, both tasks stop with no warning and the credential must be re-entered.
- **R2 sync is a mirror, not history.** `rclone sync` makes the local copy match the bucket — a file deleted in R2 disappears locally on the next run. It protects against R2 being unavailable, not against deletion. Versioned or dated snapshots would be a separate piece of work.
- **Nothing verifies the backup is still running.** The admin Health tab tracks the Obsidian sync and overdue cron via the `events` table; the backup writes no such row. A backup that stops has no alarm attached to it — which is the exact failure that went unnoticed for three months.

---

## Files touched

| File | Change |
|---|---|
| [scripts/nightly-backup.bat](../../scripts/nightly-backup.bat) | new — Git Bash wrapper + early-failure log |
| [docs/nic-checklist.md](../nic-checklist.md) | corrected the false "backup already set up" claim; recorded fixes + open items |

Config changed outside the repo: `SUPABASE_DB_URL` (machine scope) → IPv4 session pooler with the rotated password; two Task Scheduler entries.

**Commits:** `42bafcd`, `2b07bdc`, `01d9dd0` on `dev`.
