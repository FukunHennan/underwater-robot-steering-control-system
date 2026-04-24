# Install Git hooks (Windows PowerShell)
# Usage (run from repo root):
#   powershell -ExecutionPolicy Bypass -File scripts\install-git-hooks.ps1

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$HooksSrc = Join-Path $RepoRoot 'scripts\git-hooks'
$HooksDst = Join-Path $RepoRoot '.git\hooks'

if (-not (Test-Path $HooksDst)) {
    Write-Error "Missing .git\hooks. Run this inside the git repo root."
    exit 1
}

Get-ChildItem $HooksSrc -File | ForEach-Object {
    $dst = Join-Path $HooksDst $_.Name
    Copy-Item $_.FullName $dst -Force
    Write-Host "[OK] installed: $($_.Name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Git hooks installed." -ForegroundColor Cyan
Write-Host "Test: edit a file under Software/ and commit -- should be blocked." -ForegroundColor Gray
