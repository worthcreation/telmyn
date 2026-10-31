# Telmyn

Abide in Him. Become who He created you to be.

A whole-life practice app: training, health and faith, one faithful day at a time. Installable web app (PWA) on GitHub Pages at telmyn.worthcreation.com.
All logs stay on the phone (IndexedDB). Nothing personal is in this repo. See docs/PURPOSE.md and docs/ARCHITECTURE.md.

## Run locally
```
python -m http.server 8000
```
Open http://localhost:8000. The real app has no test mode.

## Push reminders
The Worker (worker/src/push.js) runs every minute and pushes due reminders. One-time setup:
powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\push-setup.ps1"
Then on the phone: Me, Reminders off and on again.

## Test app
A separate copy at https://telmyn-test.pages.dev, with its own icon (TEST badge) and its own storage, so nothing done
there can touch real data. tools/test-site.ps1 deploys it (apply.ps1 runs it after every push). It swaps in the files in
test-site/ on a temporary copy. Fake clock there: ?date=2026-11-02&time=06:25&speed=60, or tap the red banner.

## Tests
```
node tests/tests.js
```
Before every release Claude also runs `python3 tests/sweep.py` (layout at seven phone heights, button room, landscape;
one browser, about a minute). Or open /tests/ in a browser for tests.js alone.

## Release
See docs/MAP.md (where everything lives) and docs/ARCHITECTURE.md (rules and the release steps).

## Cloudflare (verse service and test app)
The Worker answers only requests from Telmyn's own addresses. Telmyn has its own Cloudflare sign-in in `.cfhome` (git-ignored), separate from NFC's. Run Wrangler through
`tools/cf.ps1` (login, whoami, deploy). The worker is also pinned to the personal account in worker/wrangler.toml.

## Credits
Greek and Hebrew word data (data/original.json): STEPBible.org TAGNT and TAHOT, from Tyndale House Cambridge, CC BY 4.0.
