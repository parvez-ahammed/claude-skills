# Copy every skill in ./skills into the Claude Code personal skills dir so they go
# live. This repo is the source of truth; ~/.claude/skills is a synced copy.
#
#   pwsh -File sync-skills.ps1            # sync all
#   pwsh -File sync-skills.ps1 -WhatIf    # preview only
[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$Dest = (Join-Path $env:USERPROFILE ".claude\skills")
)

$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot "skills"

if (-not (Test-Path $src)) { throw "No skills/ directory found at $src" }
New-Item -ItemType Directory -Force -Path $Dest | Out-Null

$count = 0
Get-ChildItem -Path $src -Directory | ForEach-Object {
  $name   = $_.Name
  $target = Join-Path $Dest $name
  if ($PSCmdlet.ShouldProcess($target, "sync skill '$name'")) {
    if (Test-Path $target) { Remove-Item -Recurse -Force $target }
    Copy-Item -Recurse -Force $_.FullName $target
    Write-Host "synced $name -> $target" -ForegroundColor Green
  }
  $count++
}
Write-Host "`n$count skill(s) processed. Restart/refresh Claude Code to pick them up." -ForegroundColor Cyan
