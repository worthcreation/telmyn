# Architecture

## Principles
1. Plain HTML, CSS and JavaScript modules. No build step, no framework. Any file can be read and edited directly.
2. Logs live only on the phone. The repo holds code and program content, never personal data.
3. One source of truth per thing:
   - Time: `js/clock.js` (supports ?test fake clock)
   - Daily fields: `js/schema.js` (form, import and export all read it)
   - Program content: `js/program/vN.js`, chosen by date in `js/program/index.js`
   - Version: `js/version.js`
   - Look: `css/tokens.css`
4. Record facts, derive everything else. Totals, statuses, handoff text and XP are computed from events, sets and fluids.
5. Blank means not recorded. 0 means recorded as zero. Non-numbers never become numbers.

## Data (IndexedDB, database `telmyn`; test mode uses `telmyn-test`)
| Store | Key | One row per | Notes |
|---|---|---|---|
| days | date | day | scalar fields from schema.js, plus imported status lines and handoff_raw |
| events | id | thing that happened | block_start, block_done, block_skip, block_partial, habit; timestamped |
| sets | id | logged set | exercise, set_no, side, reps or sec or min, mode, block, source (app or import) |
| fluids | id | drink | kind, oz, ml |
| xp | id | cached XP award | rebuilt from logs when the curve changes |
| meta | key | setting | last_export and future settings |

Schema changes: bump DB_VERSION in db.js and add a migration. Never edit an old migration.

## Program versions
v1 effective 2026-10-27. A change to the program is a new file (v2.js) with its own effective date,
registered in program/index.js. Past days keep showing the program that was in effect.

## Screens
- Today: next block (tight blocks show a time), collapsed list of the rest, counters, Log and Data.
- Runner: one step per screen, lane progress bar, rests auto-start and auto-advance, sets log with last value as a hint.
- Sheets: fluid, protein, log (tabbed by group, no scrolling), verse, data.

## Server (worker/)
telmyn-api, a Cloudflare Worker. /verse and /versions relay Bible Gateway text for personal use and cache it 7 days.
Phase 2 adds alarm pushes here. The app finds it through js/config.js (API_BASE).

## Roadmap
- Phase 2: tight-mode alarms via a Cloudflare Worker (cron + Web Push). Worker stores only block names and times.
- Phase 3: XP and levels once 3-4 weeks of real data exist. Physical skills from real accomplishments only; Discipline gives bonuses.
- Later: history and charts, settings for block mode and times, wearables.

## Verse rules (carried from the Bible study series)
Verse text in its own block, never italic, added only after checking it word for word against the NKJV.
Original-language notes show word, transliteration and literal meaning only. Contested readings get two even-handed views.
NKJV permits quoting up to 500 verses without written permission, with the copyright notice shown.
