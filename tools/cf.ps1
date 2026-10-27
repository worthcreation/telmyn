# Run Wrangler for Telmyn with Telmyn's own Cloudflare sign-in, kept in telmyn\.cfhome (never committed).
# NFC keeps its sign-in in nfc\.cfhome the same way, so the two accounts never touch.
# Examples:
#   powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\cf.ps1" login
#   powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\cf.ps1" whoami
#   powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\cf.ps1" deploy
$repo = Join-Path $HOME 'telmyn'
$cfhome = Join-Path $repo '.cfhome'
New-Item -ItemType Directory -Force (Join-Path $cfhome '.wrangler') | Out-Null
$oldProfile = $env:USERPROFILE
$env:USERPROFILE = $cfhome          # Wrangler keeps its sign-in under the home folder
Push-Location (Join-Path $repo 'worker')
try { npx.cmd --yes wrangler @args }
finally { Pop-Location; $env:USERPROFILE = $oldProfile }
exit $LASTEXITCODE
