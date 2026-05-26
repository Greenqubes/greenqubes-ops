@echo off
:: Pull latest vault from GitHub, then embed and sync to Supabase

cd /d C:\Greenqubes_GitHub\greenqubes-ops\vault
git pull

cd /d C:\Greenqubes_GitHub\greenqubes-ops
node --use-system-ca --env-file=.env.local node_modules/.bin/tsx scripts/obsidian-sync.ts
