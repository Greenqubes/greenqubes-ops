#!/usr/bin/env bash
# Cold-archive mirror: Cloudflare R2 → local external drive (D:\Greenqubes-Archive)
# Runs nightly via Windows Task Scheduler on the server PC (setup step S3).
# Configure rclone first: see setup guide step S2.
set -euo pipefail

DEST="D:\\Greenqubes-Archive"
LOG="$DEST\\logs\\backup-$(date +%Y%m%d).log"

rclone copy r2:greenqubes-files "$DEST" \
  --progress \
  --log-file="$LOG" \
  --log-level INFO \
  --transfers 8 \
  --checkers 16
