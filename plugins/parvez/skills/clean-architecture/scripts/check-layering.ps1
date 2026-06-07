# Config-driven Clean Architecture layering guard. Language-agnostic: it scans each
# layer's source for imports that layer is forbidden to have, and (optionally) checks
# the .NET .csproj reference DAG. Drive it with a clean-arch.json (see assets/).
#
#   pwsh -File check-layering.ps1 -Config clean-arch.json [-Root .]
#
# Exit 1 on any hard violation. Wire into CI / a pre-commit hook.
[CmdletBinding()]
param([string]$Config = "clean-arch.json", [string]$Root = ".")

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Config)) { throw "Config not found: $Config (copy assets/clean-arch.json and edit)" }
$cfg = Get-Content $Config -Raw | ConvertFrom-Json

$exts      = @($cfg.fileExtensions); if (-not $exts) { $exts = @('.cs','.ts','.tsx','.java','.kt','.go','.py') }
$importRe  = $cfg.importLineRegex;  if (-not $importRe) { $importRe = '^\s*(using|import|from|require|#include|use)\b' }
$fail = $false

Write-Host "Clean Architecture guard ($Config)`n"

# 1) Forbidden imports per layer (language-agnostic source scan).
foreach ($layer in $cfg.layers) {
  $files = @()
  foreach ($r in $layer.roots) {
    $dir = Join-Path $Root $r
    if (Test-Path $dir) {
      $files += Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue |
                Where-Object { $exts -contains $_.Extension }
    }
  }
  $layerHits = 0
  foreach ($f in $files) {
    $n = 0
    foreach ($line in (Get-Content $f.FullName)) {
      $n++
      if ($line -notmatch $importRe) { continue }
      foreach ($bad in $layer.forbidden) {
        if ($line -match $bad) {
          Write-Host ("  VIOLATION [{0}] {1}:{2}  forbidden /{3}/  -> {4}" -f $layer.name, $f.FullName, $n, $bad, $line.Trim()) -ForegroundColor Red
          $fail = $true; $layerHits++
        }
      }
    }
  }
  if ($layerHits -eq 0) { Write-Host ("  OK [{0}] no forbidden imports ({1} files)" -f $layer.name, $files.Count) -ForegroundColor Green }
}

# 2) Optional .NET project-reference DAG. Keys are matched as a suffix of the .csproj name.
if ($cfg.dotnet) {
  Write-Host "`n.NET project-reference DAG:"
  $csprojs = Get-ChildItem -Path $Root -Recurse -File -Filter *.csproj -ErrorAction SilentlyContinue
  foreach ($p in $csprojs) {
    $name = [IO.Path]::GetFileNameWithoutExtension($p.Name)
    $key  = ($cfg.dotnet.PSObject.Properties.Name | Where-Object { $name -like "*$_" } | Select-Object -First 1)
    if (-not $key) { continue }
    $allowed = @($cfg.dotnet.$key)
    $refs = [regex]::Matches((Get-Content $p.FullName -Raw), 'ProjectReference\s+Include="[^"]*?([\w\.]+)\.csproj"') |
            ForEach-Object { $_.Groups[1].Value }
    foreach ($ref in $refs) {
      $refKey = ($cfg.dotnet.PSObject.Properties.Name | Where-Object { $ref -like "*$_" } | Select-Object -First 1)
      if ($refKey -and ($refKey -notin $allowed)) {
        Write-Host ("  VIOLATION {0} references {1} (layer '{2}' not allowed for '{3}')" -f $name, $ref, $refKey, $key) -ForegroundColor Red
        $fail = $true
      }
    }
  }
  if (-not $fail) { Write-Host "  OK - references respect the DAG." -ForegroundColor Green }
}

if ($fail) { Write-Host "`nHard violations found." -ForegroundColor Red; exit 1 }
Write-Host "`nLayering intact." -ForegroundColor Green
