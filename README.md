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

## Release
1. Bump `APP_VERSION` in `js/version.js` and `VERSION` in `sw.js` to the same number.
2. Add a line to `docs/CHANGELOG.md`.
3. Run the tests, commit, push.
