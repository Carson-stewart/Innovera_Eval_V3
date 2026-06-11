# scripts/dev-clean.ps1 - the ONLY sanctioned dev-server (re)start after schema work.
#
# 1. Kills every process tree listening on port 3000 (logged: PID, name, reason).
# 2. Removes .next entirely (kills the stale-vendor-chunk corruption pattern:
#    prisma generate -> stale webpack cache -> every route 404s).
# 3. Starts ONE dev server in the foreground, which binds 3000.
#
# NOTE: keep this file pure ASCII - Windows PowerShell 5.1 misparses BOM-less
# files containing non-ASCII characters.
#
# Usage: npm run dev:clean

$ErrorActionPreference = "Continue"

Write-Output "[dev-clean] killing listeners on port 3000 (process trees)..."
$listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
if ($null -eq $listeners) {
  Write-Output "[dev-clean]   none found"
} else {
  foreach ($procId in $listeners) {
    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
    Write-Output ("[dev-clean]   killing PID {0} ({1}) - held port 3000; tree kill to prevent worker respawn" -f $procId, $p.ProcessName)
    taskkill /PID $procId /T /F | Out-Null
  }
  Start-Sleep -Seconds 2
  $still = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($null -ne $still) {
    Write-Error "[dev-clean] port 3000 still occupied after kill - aborting"
    exit 1
  }
}

$nextDir = Join-Path $PSScriptRoot "..\.next"
if (Test-Path $nextDir) {
  Write-Output "[dev-clean] removing .next..."
  Remove-Item -Recurse -Force $nextDir -ErrorAction SilentlyContinue
}

Write-Output "[dev-clean] starting dev server (binds 3000)..."
Set-Location (Join-Path $PSScriptRoot "..")
npm run dev
