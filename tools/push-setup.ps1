# One-time setup for push reminders. Creates the KV namespace, adds it to worker\wrangler.toml, makes the VAPID keys
# and stores them as Worker secrets, deploys the Worker, and commits the config. Safe to run again: it skips what exists.
# Run:  powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\push-setup.ps1"
$repo = Join-Path $HOME 'telmyn'
$cf = Join-Path $repo 'tools\cf.ps1'
$toml = Join-Path $repo 'worker\wrangler.toml'
if (-not (Select-String -Path $toml -Pattern 'binding = "PUSH"' -Quiet)) {
  Write-Host 'Creating the KV namespace' -ForegroundColor Cyan
  $out = (& $cf kv namespace create PUSH 2>&1 | Out-String)
  $id = [regex]::Match($out, '[0-9a-f]{32}').Value
  if (-not $id) { Write-Host 'Could not read the namespace id. Send this output to Claude:' -ForegroundColor Yellow; Write-Host $out; exit 1 }
  Add-Content $toml "`n[[kv_namespaces]]`nbinding = `"PUSH`"`nid = `"$id`""
}
Write-Host 'Making keys and storing them as Worker secrets' -ForegroundColor Cyan
$tmp = Join-Path $env:TEMP 'telmyn-vapid.json'
node (Join-Path $repo 'tools\vapid.mjs') $tmp
& $cf secret bulk $tmp
$code = $LASTEXITCODE
Remove-Item $tmp -ErrorAction SilentlyContinue
if ($code -ne 0) { Write-Host 'Storing the secrets failed. Send this output to Claude.' -ForegroundColor Yellow; exit 1 }
Write-Host 'Deploying the Worker' -ForegroundColor Cyan
& $cf deploy
if ($LASTEXITCODE -ne 0) { Write-Host 'Deploy failed. Send this output to Claude.' -ForegroundColor Yellow; exit 1 }
git -C $repo add worker/wrangler.toml; git -C $repo commit -m "Push reminders: KV namespace" --quiet; git -C $repo push --quiet
Write-Host 'Push reminders are set up. On your phone: Me, turn Reminders off and on again.' -ForegroundColor Green
