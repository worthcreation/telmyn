# Architecture

## Principles
1. Plain HTML, CSS and JavaScript modules. No build step, no framework. Any file can be read and edited directly.
2. Logs live only on the phone. The repo holds code and program content, never personal data.
3. One source of truth per thing:
   - Time: `js/clock.js` (fake clock only in the test app)
   - Which copy: `js/site.js` ('live'; the test app ships 'test')
   - Daily fields: `js/schema.js` (form, import and export all read it)
   - Program content: `js/program/vN.js`, chosen by date in `js/program/index.js` (v1.1 is the one in effect; v1 was folded into it)
   - Facts from the log (counts, totals, last times): `js/log.js`. Screens never filter events or sets themselves.
   - Version: `js/version.js`
   - Reminder rules (days, hours, intervals, follow-ups): `js/reminder-rules.js`, bundled into the Worker too
   - Look: `css/tokens.css` holds every color, text size, line height, space, radius, control height and layer order.
     `css/app.css` is one rule per component in reading order and uses only token names; nothing is appended as an
     override. Shared components: btn, chip, tile, card, lbl, note-field, layer. Text that must fit a box is sized
     only by `fitText` in `js/ui/dom.js`. Shared pieces (bar, tile, date labels, decode, plural) live in `js/ui/dom.js`
     and `js/clock.js`, never redefined in a screen. tests/tests.js fails a release that breaks any of this.
   - Where things live: `docs/MAP.md` (read first in every build).
4. Record facts, derive everything else. Totals, statuses, handoff text and XP are computed from events, sets and fluids.
5. Screens fit one phone screen: no page scrolling and no visible scrollbars. Spare space gets useful content, not padding.
6. Blank means not recorded. 0 means recorded as zero. Non-numbers never become numbers.

## Data (IndexedDB, database `telmyn`; the test app uses its own address and storage)
| Store | Key | One row per | Notes |
|---|---|---|---|
| days | date | day | scalar fields from schema.js, plus imported status lines and handoff_raw |
| events | id | thing that happened | block_start, block_done, block_skip, block_partial, habit, food; timestamped |
| sets | id | logged set | exercise, set_no, side, reps or sec or min, mode, block, source (app or import) |
| fluids | id | drink | kind, oz, ml |
| xp | id | cached XP award | rebuilt from logs when the curve changes |
| meta | key | setting or cache | settings (verse_version, study_creator, last_export, video_errors, video_picks) and caches (verse:, videos:, daily:), which backups leave out |

Schema changes: bump DB_VERSION in db.js and add a migration. Never edit an old migration.
Version 2 (0.24.0) moved weekend ankle_pumps events to calf_raises.

## Program versions
v1 effective 2026-10-27; v1.1 (warm-ups and cooldowns) effective the same day. A change to the program is a new file (v2.js) with its own effective date,
registered in program/index.js. Past days keep showing the program that was in effect.

## Screens
- Today: next block, the rest of the day, verse, Grip break (one button), quick adds (pumps, fluid, protein, Huel).
- Runner: one step per screen, chained timers, sets log with last value as a hint; study video in video mode with a
  slim overlay; a block counts as done once its cooldown starts.
- Video block: Fab Five is Gator's newest video, done when it ends; steps are the fallback.
- In-app player (media.js): every Watch button; landscape switch on every video.
- Progress: week strip (tap a day for its log), bars, weekly averages. Gear. Me: Day log, handoff, backups.
- Layers (dom.js layer/sheet/compose): every sheet and full-screen view shares one frosted look and one back behavior;
  writing opens the shared compose layer. Fluid, protein, Day log, verse study, chapter, videos, journal, test controls.

## Server (worker/)
telmyn-api, a Cloudflare Worker. Answers only Telmyn's own addresses. /verse and /versions relay Bible Gateway text
for personal use (cached 7 days); /videos finds study videos by creator (30 days); /daily returns a channel's newest
upload (1 hour); /search finds embeddable, non-Short instructional videos (30 days). /push and a cron every minute
send reminders by the rules in js/reminder-rules.js. The YouTube Data API key is the Worker secret YOUTUBE_KEY.
Phase 2 adds alarm pushes here. The app finds it through js/config.js (API_BASE).

## Delivery
Every build starts from the GitHub repo (the single source of truth). Claude sets the version with `node tools/bump.mjs
X.Y.Z` (js/version.js and sw.js together), runs `node tests/tests.js` and `python3 tests/sweep.py`, and delivers one
cumulative git patch, telmyn-X.Y.Z-YYYYMMDD-HHMM.patch. Ross runs tools/apply.ps1: it syncs with GitHub, applies the
newest telmyn patch in Downloads, runs the tests, pushes only if they pass, redeploys the Worker when worker/ or
js/reminder-rules.js changed, deploys the test app, and cleans Downloads. If anything fails, nothing is pushed.
Voice stop (on-device "stop" word, 0.21.8 to 0.23.2) was removed in 0.25.0; its code, engine and model are in the
git history at tag voice-stop.

## Roadmap
- Phase 2: tight-mode alarms via a Cloudflare Worker (cron + Web Push). Worker stores only block names and times.
- Phase 3: XP and levels once 3-4 weeks of real data exist. Physical skills from real accomplishments only; Discipline gives bonuses.
- Later: history and charts, settings for block mode and times, wearables. Voice stop can return from tag voice-stop.

## Verse rules (carried from the Bible study series)
Verse text in its own block, never italic, added only after checking it word for word against the NKJV.
Original-language notes show word, transliteration and literal meaning only. Contested readings get two even-handed views.
NKJV permits quoting up to 500 verses without written permission, with the copyright notice shown.
