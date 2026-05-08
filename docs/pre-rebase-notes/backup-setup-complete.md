# Backup System Setup — Complete

_Last updated: 2026-05-07_

## Status: ✅ WORKING

Greenqubes backup system is now fully functional.

---

## What Changed

### 1. Git Bash Path Fixed
- **File**: `scripts/greenqubes-nightly.bat`
- **Change**: Updated bash path from `C:\Program Files\Git` → `C:\Git\bin\bash.exe`
- **Reason**: Git installation is at `C:\Git`, not the default Program Files location

### 2. Supabase Connection: Direct → Pooler
- **Problem**: Direct connection only provided IPv6 addresses, but server PC only has IPv4
- **Solution**: Switched to Supabase Connection Pooler (PgBouncer)
- **Old**: `db.sotedopqyoondboareyp.supabase.co:5432` (IPv6-only)
- **New**: `aws-1-ap-southeast-1.pooler.supabase.com:6543` (IPv4)

### 3. Configuration Updated
- **File**: `.env.local` (local only, not in git)
- **Added**: `SUPABASE_DB_URL=postgresql://postgres.sotedopqyoondboareyp:GreenqubesAI2026!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`

---

## Backup Test Results ✓

```
[2026-05-07 18:53:21] === Greenqubes backup start ===
[2026-05-07 18:53:21] Syncing greenqubes-r2:greenqubes-files → E:/Greenqubes-Archive/r2
[2026-05-07 18:53:21] R2 sync complete
[2026-05-07 18:53:21] Dumping DB → E:/Greenqubes-Archive/db/greenqubes-2026-05-07_18-53-21.sql.gz
[2026-05-07 18:53:25] DB dump complete: 32K
[2026-05-07 18:53:25] Pruned DB dumps older than 30 days
[2026-05-07 18:53:25] === Backup complete ===
```

**Archive contents**:
- `E:\Greenqubes-Archive\db\` — SQL database dumps (gzipped, 30+ KB each)
- `E:\Greenqubes-Archive\r2\` — Synced files from Cloudflare R2
- `E:\Greenqubes-Archive\logs\` — Timestamped backup logs

---

## Next Steps

### Option A: Automatic Setup (Recommended)

Run the helper script as Administrator:

```powershell
! powershell -NoProfile -ExecutionPolicy Bypass -File C:\greenqubes-ops\scripts\set-db-url.ps1
```

This sets `SUPABASE_DB_URL` as a Windows System environment variable so the nightly task scheduler job has access to it.

### Option B: Manual Setup

1. Open **Settings** → **System** → **Advanced system settings** → **Environment Variables**
2. Click **New** (under System variables)
3. Variable name: `SUPABASE_DB_URL`
4. Variable value: `postgresql://postgres.sotedopqyoondboareyp:GreenqubesAI2026!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`
5. Click **OK** and close

---

## Nightly Schedule

The Task Scheduler job is set to run daily at **02:00 (2 AM)**.

**What it does**:
1. Pull latest Obsidian vault from GitHub
2. Run `obsidian-sync` to index vault notes to Supabase
3. Run backup:
   - Sync R2 to `E:\Greenqubes-Archive\r2`
   - Dump Postgres to `E:\Greenqubes-Archive\db\greenqubes-YYYY-MM-DD_HH-MM-SS.sql.gz`
   - Clean up dumps older than 30 days

**To verify it's working**:
- Check `E:\Greenqubes-Archive\logs\nightly.log` the morning after setup
- Confirm latest SQL dump was created in `E:\Greenqubes-Archive\db\`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backup still fails with DNS error | Run Option A setup script as Administrator |
| Files not syncing to E:\ | Check if E:\ drive is mounted and has space |
| Old backup error files remain | Safe to delete 20-byte `.sql.gz` files (failed attempts) |
| Nightly script doesn't run | Check Task Scheduler: `taskschd.msc` → find "Greenqubes nightly" task |

---

## Files Changed This Session

- `scripts/greenqubes-nightly.bat` — bash path fix
- `scripts/backup.sh` — explicit pg_dump path
- `scripts/set-db-url.ps1` — helper to set env var
- `.env.local` — added SUPABASE_DB_URL (local only)

**Commits**:
- `94761be` — fix bash path
- `42c9b95` — pooler connection config

---

## Architecture Notes

The backup system uses:
- **pg_dump** over PostgreSQL connection to export schema + data
- **rclone** to sync R2 bucket to local E:\ drive
- **gzip** compression for database dumps
- **Windows Task Scheduler** for daily automation
- **Git Bash** (MSYS2) to run shell scripts on Windows

This creates a **cold archive** — independent local copy of all job files and database, kept in sync daily.
