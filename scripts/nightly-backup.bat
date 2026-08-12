@echo off
:: Nightly cold-archive backup — syncs Cloudflare R2 to the local drive and dumps the Supabase DB.
:: Runs scripts/backup.sh under Git Bash.
::
:: Scheduled daily at 02:00 via Task Scheduler, task name "Greenqubes Nightly Backup".
::
:: Requires on this server PC:
::   - Git Bash at C:\Git\bin\bash.exe
::   - rclone at C:\rclone with the greenqubes-r2 remote configured
::   - pg_dump from PostgreSQL 18 (path is hardcoded inside backup.sh)
::   - SUPABASE_DB_URL set as a machine environment variable (direct connection URI, not the pooler)

setlocal

set PATH=C:\rclone;%PATH%
set BACKUP_ROOT=E:/Greenqubes-Archive

"C:\Git\bin\bash.exe" -c "/e/greenqubes-ops/scripts/backup.sh"
set RC=%ERRORLEVEL%

:: backup.sh writes its own timestamped log. This only catches failures that happen
:: before that log exists — a missing env var, bash not found, the drive being offline.
if not "%RC%"=="0" (
  echo [%DATE% %TIME%] nightly-backup.bat FAILED with exit code %RC% >> E:\Greenqubes-Archive\logs\wrapper-errors.log
)

exit /b %RC%
