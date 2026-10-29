# One-time setup for the cloud copy (0.16). Creates the D1 database, adds it to worker\wrangler.toml, makes the two sync
# keys and stores them as Worker secrets, deploys, commits the config, checks it works, then shows:
#   1. a QR code for the phone (opens Telmyn with the write key, which turns the cloud copy on), and
#   2. the read link to paste into chat, copied to the clipboard.
# The keys are kept in telmyn\.cfhome\sync.json (never committed), so running this again reuses them and only re-shows
# the QR code and the link. Delete that file and run again to make new keys (then scan the new QR code).
# Run:  powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\sync-setup.ps1"
$repo = Join-Path $HOME 'telmyn'
$cf = Join-Path $repo 'tools\cf.ps1'
$toml = Join-Path $repo 'worker\wrangler.toml'
$keyFile = Join-Path $repo '.cfhome\sync.json'
$api = 'https://telmyn-api.worthcreation.workers.dev'
$uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
function New-SyncKey { $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join '' }
Set-Location $repo

if (-not (Select-String -Path $toml -Pattern 'binding = "DB"' -Quiet)) {
  Write-Host 'Creating the database' -ForegroundColor Cyan
  $out = (& $cf d1 create telmyn 2>&1 | Out-String)
  $id = [regex]::Match($out, $uuid).Value
  if (-not $id) { $out = (& $cf d1 info telmyn --json 2>&1 | Out-String); $id = [regex]::Match($out, $uuid).Value }
  if (-not $id) { Write-Host 'Could not read the database id. Send this output to Claude:' -ForegroundColor Yellow; Write-Host $out; exit 1 }
  Add-Content $toml "`n# Cloud copy of the daily log (tools/sync-setup.ps1).`n[[d1_databases]]`nbinding = `"DB`"`ndatabase_name = `"telmyn`"`ndatabase_id = `"$id`""
}

if (Test-Path $keyFile) { $k = Get-Content $keyFile -Raw | ConvertFrom-Json; $fresh = $false }
else { $k = [pscustomobject]@{ write = (New-SyncKey); read = (New-SyncKey) }; [IO.File]::WriteAllText($keyFile, ($k | ConvertTo-Json)); $fresh = $true }

if ($fresh) {
  Write-Host 'Storing the sync keys as Worker secrets' -ForegroundColor Cyan
  $tmp = Join-Path $env:TEMP 'telmyn-sync.json'
  [IO.File]::WriteAllText($tmp, (@{ SYNC_WRITE = $k.write; SYNC_READ = $k.read } | ConvertTo-Json))
  & $cf secret bulk $tmp
  $code = $LASTEXITCODE
  Remove-Item $tmp -ErrorAction SilentlyContinue
  if ($code -ne 0) { Remove-Item $keyFile; Write-Host 'Storing the secrets failed. Send this output to Claude.' -ForegroundColor Yellow; exit 1 }
}

Write-Host 'Deploying the Worker' -ForegroundColor Cyan
& $cf deploy
if ($LASTEXITCODE -ne 0) { Write-Host 'Deploy failed. Send this output to Claude.' -ForegroundColor Yellow; exit 1 }
if (git status --porcelain worker/wrangler.toml) { git add worker/wrangler.toml; git commit -m "Cloud copy: D1 database" --quiet; git push --quiet }

$read = "$api/sync/read?k=$($k.read)"
Write-Host 'Checking the read link' -ForegroundColor Cyan
Start-Sleep -Seconds 5
try { $r = Invoke-WebRequest -Uri "$read&days=1" -UseBasicParsing; Write-Host ($r.Content.Split("`n")[0]) }
catch { Write-Host "The read link did not answer yet ($($_.Exception.Message)). Wait a minute and open it in a browser; if it still fails, send this to Claude." -ForegroundColor Yellow }

$phone = "https://telmyn.worthcreation.com/#sync=$($k.write)"
Write-Host ''
Write-Host 'PHONE: scan this with the phone camera and open it in Telmyn (or Chrome). It turns the cloud copy on.' -ForegroundColor Green
npx.cmd --yes qrcode-terminal $phone
Write-Host ''
Set-Clipboard -Value $read
Write-Host 'CHAT: your read link is on the clipboard. Paste it into the chat with Claude:' -ForegroundColor Green
Write-Host $read
Write-Host 'Keep both private: the QR code can write to your log, the read link can read it.' -ForegroundColor Yellow
