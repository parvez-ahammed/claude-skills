# Install the secret-hygiene pre-commit hook into a target git repo.
#   pwsh -File install.ps1 -Repo C:\path\to\repo      # defaults to current dir
param([string]$Repo = (Get-Location).Path)

$ErrorActionPreference = 'Stop'
$gitDir = Join-Path $Repo ".git"
if (-not (Test-Path $gitDir)) { throw "$Repo is not a git repo (.git not found)" }

$src  = Join-Path $PSScriptRoot "pre-commit"
$dest = Join-Path $gitDir "hooks/pre-commit"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null

if (Test-Path $dest) { Copy-Item $dest "$dest.bak" -Force; Write-Host "backed up existing hook -> pre-commit.bak" }
Copy-Item $src $dest -Force
# Make executable where chmod exists (Git Bash / WSL / macOS / Linux).
if (Get-Command bash -ErrorAction SilentlyContinue) { bash -c "chmod +x '$($dest -replace '\\','/')'" }

Write-Host "installed secret-hygiene pre-commit -> $dest" -ForegroundColor Green
Write-Host "Tip: install gitleaks for best coverage (the hook uses it when present)."
