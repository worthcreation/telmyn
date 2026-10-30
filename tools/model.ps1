# Telmyn voice stop: fetch Google's open speech-commands model (18 words, Apache 2.0) into the repo once, so the app
# serves it itself and no audio or request ever goes to Google from the phone. Then push it and refresh the test app.
# Run once (after the 0.22.0 patch or later):
#   powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\model.ps1"
$ErrorActionPreference = 'Stop'
$repo = Join-Path $HOME 'telmyn'
$base = 'https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w'
$dir = Join-Path $repo 'data\models\speech-commands'
New-Item -ItemType Directory -Force $dir | Out-Null
Set-Location $repo
try {
  Write-Host 'Downloading the speech model' -ForegroundColor Cyan
  foreach ($f in @('model.json', 'metadata.json')) { Invoke-WebRequest "$base/$f" -OutFile (Join-Path $dir $f) -UseBasicParsing }
  $model = Get-Content (Join-Path $dir 'model.json') -Raw | ConvertFrom-Json
  foreach ($group in $model.weightsManifest) { foreach ($p in $group.paths) { Invoke-WebRequest "$base/$p" -OutFile (Join-Path $dir $p) -UseBasicParsing } }
  $meta = Get-Content (Join-Path $dir 'metadata.json') -Raw | ConvertFrom-Json
  # Newer models list their words as wordLabels, this one (like the library allows) as words.
  $words = @(if ($meta.wordLabels) { $meta.wordLabels } else { $meta.words })
  if (-not ($words -contains 'stop')) { throw "The model has no ""stop"" word (words found: $($words -join ', '))." }
} catch {
  Write-Host "Download failed: $($_.Exception.Message). Nothing was pushed. Send this output to Claude." -ForegroundColor Red; exit 1
}
$size = [math]::Round(((Get-ChildItem $dir | Measure-Object Length -Sum).Sum) / 1MB, 1)
Write-Host "Model ready ($size MB, words: $($words -join ', '))" -ForegroundColor Green
git add data/models; git commit -q -m 'Speech model for voice stop (Google speech-commands 18w, Apache 2.0)'
if ($LASTEXITCODE -ne 0) { Write-Host 'Nothing new to commit (model already in place).' -ForegroundColor Yellow; exit 0 }
git push -q
if ($LASTEXITCODE -ne 0) { Write-Host 'Push failed. Run "git push" in the telmyn folder after fixing the connection.' -ForegroundColor Red; exit 1 }
& (Join-Path $repo 'tools\test-site.ps1')
Write-Host 'Voice stop model is live. Turn on the mic in a block to use it.' -ForegroundColor Green
