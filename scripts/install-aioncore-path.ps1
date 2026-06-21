# Add bundled AionCore directory to the current user's PATH (Windows).
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$bundleDir = Join-Path $repoRoot 'resources\bundled-aioncore\win32-x64'

if (-not (Test-Path (Join-Path $bundleDir 'aioncore.exe'))) {
  Write-Host 'AionCore binary not found. Running prepareAioncore...'
  Push-Location $repoRoot
  node scripts/prepareAioncore.js --platform win32 --arch x64
  Pop-Location
}

if (-not (Test-Path (Join-Path $bundleDir 'aioncore.exe'))) {
  throw "aioncore.exe still missing at $bundleDir"
}

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$segments = @()
if ($userPath) {
  $segments = $userPath -split ';' | Where-Object { $_ -and $_.Trim() -ne '' }
}

if ($segments -contains $bundleDir) {
  Write-Host "Already on PATH: $bundleDir"
  exit 0
}

$segments += $bundleDir
$newPath = ($segments -join ';')
[Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
$env:Path = "$bundleDir;$env:Path"

Write-Host "Added to user PATH: $bundleDir"
Write-Host 'Open a new terminal for PATH changes to apply everywhere.'
