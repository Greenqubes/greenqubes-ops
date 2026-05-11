@echo off
setlocal EnableDelayedExpansion

REM ── Greenqubes Nightly Runner ───────────────────────────────────────────────
REM Scheduled via Windows Task Scheduler at 02:00 daily.
REM
REM Prerequisites (one-time setup on server PC):
REM   1. Git installed, greenqubes-kb vault cloned at E:\greenqubes-kb
REM   2. Node.js (LTS) installed
REM   3. This repo (greenqubes-ops) cloned at REPO path below
REM   4. npm install run inside REPO once
REM   5. .env.local copied into REPO with all keys + OBSIDIAN_VAULT_PATH
REM   6. rclone configured: run "rclone config" to add remote "greenqubes-r2"
REM   7. SUPABASE_DB_URL set as a Windows System Environment Variable
REM      (Control Panel -> Advanced System Settings -> Environment Variables)
REM   8. Server hard disk at E:\ (vault + archive)
REM
REM To schedule:
REM   taskschd.msc -> Create Basic Task
REM   Trigger:  Daily at 02:00
REM   Action:   Start a program
REM   Program:  C:\greenqubes-ops\scripts\greenqubes-nightly.bat
REM ────────────────────────────────────────────────────────────────────────────

set REPO=C:\greenqubes-ops
set VAULT=E:\greenqubes-kb
set BASH=C:\Git\bin\bash.exe
set LOG_DIR=E:\Greenqubes-Archive\logs

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

set LOG=%LOG_DIR%\nightly.log

call :log "========================================"
call :log "Greenqubes nightly — START"
call :log "========================================"

REM ── Step 1: Pull latest vault notes from GitHub ───────────────────────────
call :log "[1/4] Pulling vault from GitHub..."
cd /d "%VAULT%"
if errorlevel 1 (
  call :log "ERROR: vault folder not found at %VAULT% - skipping obsidian-sync"
  goto step3
)
git pull --quiet >> "%LOG%" 2>&1
if errorlevel 1 (
  call :log "WARNING: git pull failed - continuing with existing notes"
) else (
  call :log "       Vault pull OK"
)

REM ── Step 2: Index vault notes to Supabase ─────────────────────────────────
:step2
call :log "[2/4] Running obsidian-sync..."
cd /d "%REPO%"
call npm run obsidian-sync >> "%LOG%" 2>&1
if errorlevel 1 (
  call :log "WARNING: obsidian-sync exited with errors - check log above"
) else (
  call :log "       obsidian-sync OK"
)

REM ── Step 3: R2 cold archive + Supabase DB dump ────────────────────────────
:step3
call :log "[3/4] Running backup (R2 sync + DB dump)..."
"%BASH%" -c "export SUPABASE_DB_URL='%SUPABASE_DB_URL%'; export BACKUP_ROOT='E:/Greenqubes-Archive'; %REPO%/scripts/backup.sh" >> "%LOG%" 2>&1
if errorlevel 1 (
  call :log "ERROR: backup.sh failed - check log above"
) else (
  call :log "       Backup OK"
)

REM ── Step 4: Sync bug reports from Supabase → local markdown → git push ─────
:step4
call :log "[4/4] Syncing bug reports..."
cd /d "%REPO%"
call npm run sync-bugs >> "%LOG%" 2>&1
if errorlevel 1 (
  call :log "WARNING: sync-bugs exited with errors - check log above"
  goto done
)
call :log "       sync-bugs OK"

REM Commit and push any new bug report files
git add bugs_reported\ >> "%LOG%" 2>&1
git diff --cached --quiet
if errorlevel 1 (
  call :log "       Committing new bug reports..."
  git commit -m "chore: nightly bug report sync [skip ci]" >> "%LOG%" 2>&1
  git push origin dev >> "%LOG%" 2>&1
  if errorlevel 1 (
    call :log "WARNING: git push failed - check log above"
  ) else (
    call :log "       Bug reports pushed to dev"
  )
) else (
  call :log "       No new bug reports to commit"
)

:done
call :log "========================================"
call :log "Greenqubes nightly — DONE"
call :log "========================================"
endlocal
goto :eof

:log
echo [%DATE% %TIME%] %~1
echo [%DATE% %TIME%] %~1 >> "%LOG%"
goto :eof
