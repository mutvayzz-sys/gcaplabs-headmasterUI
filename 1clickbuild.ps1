# Headmaster 1-Click Build (Fast)
# Usage: .\1clickbuild.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "[1/2] Typecheck..." -ForegroundColor Cyan
npx tsc --noEmit

Write-Host "[2/2] Bundle (Vite only, no packaging)..." -ForegroundColor Cyan
npx electron-vite build --config packages/desktop/electron.vite.config.ts

Write-Host "`nDone. For dev testing, run:" -ForegroundColor Green
Write-Host "  npx electron-vite dev"
Write-Host "`nFor packaged build (slow), run:" -ForegroundColor Yellow
Write-Host "  node scripts/build-with-builder.js auto --win --dir"
