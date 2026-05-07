#!/usr/bin/env bash
# Greenqubes cold-archive backup
# Syncs Cloudflare R2 to a local external drive and dumps the Supabase DB.
#
# ── One-time setup ───────────────────────────────────────────────────────────
# 1. Install rclone: https://rclone.org/install/
# 2. Configure the R2 remote (run once interactively):
#      rclone config
#      name:              greenqubes-r2
#      type:              s3
#      provider:          Cloudflare
#      access_key_id:     <R2_ACCESS_KEY_ID from .env.local>
#      secret_access_key: <R2_SECRET_ACCESS_KEY from .env.local>
#      endpoint:          https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
# 3. Install pg_dump: comes with PostgreSQL client tools
#      Windows: https://www.postgresql.org/download/windows/ (select "Command Line Tools")
# 4. Set SUPABASE_DB_URL to the Supabase "Direct connection" URI
#      Dashboard → Settings → Database → Connection string → URI (NOT the pooler URL)
#      Format: postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
#
# ── Scheduling ───────────────────────────────────────────────────────────────
# Windows Task Scheduler (Git Bash), runs at 03:00 SGT daily:
#   - Open Task Scheduler → Create Basic Task
#   - Trigger: Daily at 03:00
#   - Action: Start a program
#       Program: "C:\Program Files\Git\bin\bash.exe"
#       Arguments: C:\Greenqubes_GitHub\greenqubes-ops\scripts\backup.sh
#   - Set SUPABASE_DB_URL + BACKUP_ROOT as System env vars (Control Panel → Advanced System Settings)
#
# WSL crontab (runs at 19:00 UTC = 03:00 SGT next day):
#   0 19 * * * SUPABASE_DB_URL="..." BACKUP_ROOT="/mnt/e/Greenqubes-Archive" /path/to/backup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-E:/Greenqubes-Archive}"
SUPABASE_DB_URL="${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the Supabase direct connection URI}"
R2_REMOTE="${R2_REMOTE:-greenqubes-r2}"
R2_BUCKET="${R2_BUCKET:-greenqubes-files}"

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
LOG_DIR="$BACKUP_ROOT/logs"
LOG_FILE="$LOG_DIR/backup-$TIMESTAMP.log"

mkdir -p "$BACKUP_ROOT/r2" "$BACKUP_ROOT/db" "$LOG_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

log "=== Greenqubes backup start: $TIMESTAMP ==="

# ── R2 → local sync ──────────────────────────────────────────────────────────
log "Syncing $R2_REMOTE:$R2_BUCKET → $BACKUP_ROOT/r2"
rclone sync "$R2_REMOTE:$R2_BUCKET" "$BACKUP_ROOT/r2" \
  --log-level INFO \
  --log-file "$LOG_FILE" \
  --transfers 4 \
  --checkers 8
log "R2 sync complete"

# ── Supabase DB dump ──────────────────────────────────────────────────────────
DB_FILE="$BACKUP_ROOT/db/greenqubes-$TIMESTAMP.sql.gz"
log "Dumping DB → $DB_FILE"
"/c/Program Files/PostgreSQL/18/bin/pg_dump.exe" "$SUPABASE_DB_URL" \
  --no-owner \
  --no-acl \
  --schema=public \
  | gzip > "$DB_FILE"
log "DB dump complete: $(du -h "$DB_FILE" | cut -f1)"

# ── Prune DB dumps older than 30 days ────────────────────────────────────────
find "$BACKUP_ROOT/db" -name "*.sql.gz" -mtime +30 -delete
log "Pruned DB dumps older than 30 days"

log "=== Backup complete ==="
