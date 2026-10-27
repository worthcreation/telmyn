# Telmyn: apply the newest patch file from Downloads, run the tests, push only if they pass, then clean up.
# Each patch file Claude sends is cumulative (everything since what is live on GitHub), so only the newest one is used.
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\apply.ps1"
$ErrorActionPreference = 'Continue'
$repo = Join-Path $HOME 'telmyn'
$dl = Join-Path $HOME 'Downloads'
Set-Location $repo

$all = @(Get-ChildItem $dl -Filter 'telmyn-*.patch' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime)
$patches = @($all | Select-Object -Last 1)
if ($all.Count -eq 0) { Write-Host 'No telmyn-*.patch files in Downloads. Nothing to do.' -ForegroundColor Yellow; exit 1 }

if (git status --porcelain) { Write-Host 'The telmyn folder has uncommitted changes. Stopping so nothing is lost. Send this to Claude:' -ForegroundColor Red; git status --short; exit 1 }

git pull --ff-only -q
if ($LASTEXITCODE -ne 0) { Write-Host 'Could not sync with GitHub first. Nothing was changed.' -ForegroundColor Red; exit 1 }
$before = git rev-parse HEAD

foreach ($p in $patches) {
  Write-Host "Applying $($p.Name)" -ForegroundColor Cyan
  git am -q $p.FullName
  if ($LASTEXITCODE -ne 0) {
    git am --abort; git reset -q --hard $before
    Write-Host "That patch does not match your files. Nothing was changed. Send this output to Claude." -ForegroundColor Red; exit 1
  }
}

Write-Host 'Running tests' -ForegroundColor Cyan
node tests/tests.js
if ($LASTEXITCODE -ne 0) {
  git reset -q --hard $before
  Write-Host 'Tests failed, so nothing was pushed and your files are back as they were. Send this output to Claude.' -ForegroundColor Red; exit 1
}

git push -q
if ($LASTEXITCODE -ne 0) { Write-Host 'Push failed. The patch is applied locally; run "git push" after fixing the connection.' -ForegroundColor Red; exit 1 }

$all | Remove-Item
Get-ChildItem $dl -Filter 'telmyn*.zip' -ErrorAction SilentlyContinue | Remove-Item
$version = (Select-String -Path 'js\version.js' -Pattern "'(.+)'").Matches[0].Groups[1].Value
Write-Host "Pushed Telmyn $version. Patches and old zips removed from Downloads." -ForegroundColor Green
