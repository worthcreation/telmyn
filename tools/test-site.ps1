# Telmyn test app: deploy a separate copy to Cloudflare Pages (telmyn-test.pages.dev).
# Its own web address means its own storage, so nothing done there can touch the real app's data.
# It swaps in the test-site files (site flag, "Telmyn Test" name, TEST icons) on a temporary copy; the repo is never changed.
# One-time setup:  powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\cf.ps1" pages project create telmyn-test --production-branch main
# Deploy (apply.ps1 also runs this after every push):  powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\test-site.ps1"
$repo = Join-Path $HOME 'telmyn'
$stage = Join-Path $env:TEMP 'telmyn-test-site'
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($item in @('index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'data', 'icons')) {
  Copy-Item -Recurse -Force (Join-Path $repo $item) $stage
}
Copy-Item -Recurse -Force (Join-Path $repo 'test-site\*') $stage
if (-not (Select-String -Path (Join-Path $stage 'js\site.js') -Pattern "SITE = 'test'" -Quiet)) { Write-Host 'Test flag missing in the copy. Not deploying.' -ForegroundColor Red; exit 1 }
Write-Host 'Deploying the test app' -ForegroundColor Cyan
& (Join-Path $repo 'tools\cf.ps1') pages deploy $stage --project-name telmyn-test --branch main --commit-dirty=true
$code = $LASTEXITCODE
Remove-Item -Recurse -Force $stage
if ($code -ne 0) { Write-Host 'Test app deploy failed. The real app is not affected. Send this output to Claude.' -ForegroundColor Yellow; exit $code }
Write-Host 'Test app live at https://telmyn-test.pages.dev' -ForegroundColor Green
