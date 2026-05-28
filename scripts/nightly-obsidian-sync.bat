@echo off
:: Pull latest vault from GitHub, then embed and sync to Supabase
:: IMPORTANT: Update the two paths below to match where the repo lives on this server PC

cd /d E:\greenqubes-ops\vault
git pull

cd /d E:\greenqubes-ops
call node_modules\.bin\tsx.cmd --use-system-ca --env-file=.env.local scripts/obsidian-sync.ts
