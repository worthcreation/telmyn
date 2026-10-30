# Project instructions. Claude sends them at handoff as telmyn-project-instructions-YYYY-MM-DD.md. This keeps a dated
# private copy in telmyn\.cfhome\instructions (never in git: the repo is public and the instructions hold health notes
# and the cloud copy link) and puts the newest on the clipboard, ready to paste into the Telmyn Project.
# apply.ps1 runs it with -Quiet (clipboard only when a new file arrived). Run it yourself any time to copy them again:
#   powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\instructions.ps1"
param([switch]$Quiet)
$repo = Join-Path $HOME 'telmyn'
$dl = Join-Path $HOME 'Downloads'
$dir = Join-Path $repo '.cfhome\instructions'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$new = @(Get-ChildItem $dl -Filter 'telmyn-project-instructions-*.md' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime)
$fresh = $new.Count -gt 0
if ($fresh) {
  $pick = $new[-1]
  $name = ($pick.BaseName -replace '\s*\(\d+\)$', '') + '.md'
  Copy-Item $pick.FullName (Join-Path $dir $name) -Force
  $new | Remove-Item
}

$latest = Get-ChildItem $dir -Filter '*.md' -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -Last 1
if (-not $latest) { Write-Host 'No Project instructions saved yet.' -ForegroundColor Yellow; exit 0 }
if ($fresh -or -not $Quiet) {
  Set-Clipboard -Value (Get-Content $latest.FullName -Raw -Encoding UTF8)
  Write-Host "Project instructions ($($latest.BaseName)) are on the clipboard. Paste them into the Telmyn Project instructions now." -ForegroundColor Green
} else {
  Write-Host "Project instructions unchanged ($($latest.BaseName))." -ForegroundColor Gray
}
