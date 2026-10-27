# Telmyn

Abide in Him. Become who He created you to be.

A whole-life practice app: training, health and faith, one faithful day at a time. Installable web app (PWA) on GitHub Pages at telmyn.worthcreation.com.
All logs stay on the phone (IndexedDB). Nothing personal is in this repo. See docs/PURPOSE.md and docs/ARCHITECTURE.md.

## Run locally
```
python -m http.server 8000
```
Open http://localhost:8000. Test mode with a fake clock: http://localhost:8000/?test&date=2026-11-02&time=06:25&speed=60

## Tests
```
node tests/tests.js
```
Or open /tests/ in a browser.

## Release (how updates ship)
1. Claude starts every build from this GitHub repo, makes the change, sets the version with `node tools/bump.mjs X.Y.Z`
   (updates js/version.js and sw.js together), runs the tests, and delivers one git patch file named
   `telmyn-X.Y.Z-YYYYMMDD-HHMM.patch`.
2. Ross downloads the patch and runs:
```
powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\apply.ps1"
```
   It syncs with GitHub, applies every telmyn patch in Downloads in order, runs the tests, pushes only if they pass,
   and deletes the patches and any old telmyn zips. If anything fails, nothing is pushed and the files are put back.
