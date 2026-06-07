# Move backend secrets that live only in a PaaS secret store into GitHub Secrets,
# so the VPS pipeline (single source of truth = GitHub) can render them.
#
# This example reads from Azure Container Apps; adapt the read command for your
# source (Render/Heroku/Fly env, a .env file, a vault). The point is the az->gh
# loop. Run it in YOUR OWN session - an automated safety layer will (correctly)
# block an assistant from reading production secret VALUES, so you run it.
#
#   pwsh -File migrate-secrets.ps1
#
# Requires az + gh logged in with access to the source and the repo.

$ErrorActionPreference = 'Stop'
$Repo   = 'OWNER/REPO'
$AcaApp = 'your-api-containerapp'
$AcaRg  = 'your-resource-group'

# source-secret-name -> GitHub-secret-name
$map = [ordered]@{
  'db-connection-string' = 'DB_CONNECTION_STRING'
  'telegram-bot-token'   = 'TELEGRAM_BOT_TOKEN'
  'gemini-api-key'       = 'GEMINI_API_KEY'
  # ...add the rest...
}

foreach ($src in $map.Keys) {
  $dst = $map[$src]
  $val = az containerapp secret show -n $AcaApp -g $AcaRg --secret-name $src --query value -o tsv 2>$null
  if ([string]::IsNullOrWhiteSpace($val)) { Write-Host "SKIP $dst (source '$src' empty/missing)"; continue }
  $val | gh secret set $dst -R $Repo
  Write-Host "set $dst"
}

Write-Host "`nGitHub secrets now:"; gh secret list -R $Repo
