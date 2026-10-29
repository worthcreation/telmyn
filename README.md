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
Before every release Claude also runs tests/layout_sweep.py: every page and sheet at eight phone heights (640 to 915 px).
Or open /tests/ in a browser.

## Release (how updates ship)
1. Claude starts every build from this GitHub repo, makes the change, sets the version with `node tools/bump.mjs X.Y.Z`
   (updates js/version.js and sw.js together), runs the tests, and delivers one git patch file named
   `telmyn-X.Y.Z-YYYYMMDD-HHMM.patch`.
2. Ross downloads the patch and runs:
```
powershell -ExecutionPolicy Bypass -File "$HOME\telmyn\tools\apply.ps1"
```
   Each patch is cumulative (everything since what is live), one file per update. The script syncs with GitHub,
   applies the newest telmyn patch in Downloads, runs the tests, pushes only if they pass, and deletes all telmyn
   patches and zips from Downloads. If anything fails, nothing is pushed and the files are put back.

## Cloudflare (verse service and test app)
The Worker answers only requests from Telmyn's own addresses. Telmyn has its own Cloudflare sign-in in `.cfhome` (git-ignored), separate from NFC's. Run Wrangler through
`tools/cf.ps1` (login, whoami, deploy). The worker is also pinned to the personal account in worker/wrangler.toml.

## Credits
Greek and Hebrew word data (data/original.json): STEPBible.org TAGNT and TAHOT, from Tyndale House Cambridge, CC BY 4.0.
