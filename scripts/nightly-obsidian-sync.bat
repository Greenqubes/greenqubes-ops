@echo off
:: Pull latest vault from GitHub, then embed and sync to Supabase
:: IMPORTANT: Update the two paths below to match where the repo lives on this server PC

cd /d C:\Greenqubes_GitHub\greenqubes-ops\vault
git pull

cd /d C:\Greenqubes_GitHub\greenqubes-ops
node --use-system-ca --env-file=.env.local node_modules\.bin\tsx.cmd scripts/obsidian-sync.ts
