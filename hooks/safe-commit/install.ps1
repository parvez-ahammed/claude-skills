# Install the safe-commit commit-msg hook into a target git repo.
#   pwsh -File install.ps1 -Repo C:\path\to\repo      # defaults to current dir
param([string]$Repo = (Get-Location).Path)

$ErrorActionPreference = 'Stop'
$gitDir = Join-Path $Repo ".git"
if (-not (Test-Path $gitDir)) { throw "$Repo is not a git repo (.git not found)" }

$src  = Join-Path $PSScriptRoot "commit-msg"
$dest = Join-Path $gitDir "hooks/commit-msg"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null

if (Test-Path $dest) { Copy-Item $dest "$dest.bak" -Force; Write-Host "backed up existing hook -> commit-msg.bak" }
Copy-Item $src $dest -Force
if (Get-Command bash -ErrorAction SilentlyContinue) { bash -c "chmod +x '$($dest -replace '\\','/')'" }

Write-Host "installed safe-commit commit-msg -> $dest" -ForegroundColor Green
Write-Host "Optional strict mode: set SAFE_COMMIT_NO_EMDASH=1 and/or SAFE_COMMIT_NO_AI_COAUTHOR=1 in your env."
