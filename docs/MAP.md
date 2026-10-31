# Map: where everything lives

Read this first in every build chat. One line per file: what it owns. Then "to change X, edit Y."

## App (js/)
| File | Owns |
|---|---|
| main.js | Boot: open storage, load today, start the shell, updates (Update Ready), reminders, cloud copy |
| clock.js | Time. now(), isoDate, hhmm, atTime, dayLabel, addDays, weekday. Fake clock in the test app |
| db.js | IndexedDB stores and migrations (DB_VERSION), backups (exportAll, importAll) |
| schema.js | The day's fields (DAY_FIELDS: form, import, export), FLUID_KINDS, cleanNumber |
| log.js | What happened: every query over events, sets and fluids (grip breaks, leg habits, pulls, hangs, rowed, fluids) |
| state.js | The day on screen: load, add and remove events, sets, fluids, foods, protein; importDay; legToday |
| program/index.js | Which program is in effect, planFor(date) (blocks in order, day type, week and day), blockStatus, legHabit |
| program/v1_1.js | The program content: EXERCISES (videos, weights), BLOCKS (steps), DAY_TYPES, SCHEDULE, HABITS, TARGETS |
| program/steps.js | Step builders used by the program file (do, timed, rest, set, sets, sides, phase) |
| reminder-rules.js | Reminder days, hours, intervals, follow-ups; due(). Bundled into the Worker too |
| remind.js | Reminders on the phone: permission, push subscription, state reports to the Worker, in-app checks |
| status.js | Judging the day: pace (fluids, protein), overdue (grip, pumps, calf), weight age, toward-best fills |
| hourly.js | Grip-break history and the next palms |
| handoff.js | The handoff text: parseHandoff (restore) and buildHandoff (cloud copy, export) |
| sync.js | Cloud copy: dayRecord(date) and sending it to the Worker |
| verses.js | The verse bank and verseFor(date) |
| scripture.js | Verse text, versions, study videos, the daily Fab Five video, favorites, watched |
| foods.js | One-tap foods (Huel) |
| flow.js | Seconds to get into position between steps |
| voice.js | Reading speed for Listen (text-to-speech) |
| xp.js | Skills and XP (computed from the log; not shown yet) |
| config.js | Worker address, which blocks play a daily video |
| site.js, version.js | 'live' or 'test'; the release number (set with tools/bump.mjs) |

## Screens (js/ui/)
| File | Owns |
|---|---|
| dom.js | The kit: h, fill, layer, sheet, compose, noteField, fitText, toast, sounds, holdable, bar, tile, decode, plural |
| shell.js | The frame: status pills (Fluids, Protein, Grip, Pumps or Calf), the current tab, the tab bar |
| today.js | Today: date, verse card, next block, day list, Weight button |
| runner.js | The block runner: one step per screen, timers, set logging, resume, cooldown |
| video-block.js | A block that is a video (Fab Five) |
| study-player.js | Study while you train: video (auto-next, resume), read, listen; videoRow |
| media.js | The in-app video player for Watch buttons, landscape |
| progress.js | This week: strip, bars, averages |
| day.js | The Day log for one day, with arrows between days |
| detail.js | Breakdowns (week or day, per area) and the next-time tips from the progression rules |
| forms.js | Fluid and Protein sheets, the full day form (Edit this day), entry lists |
| history.js | Hold on Grip, Pumps or Calf, Weight: today's entries, the last 7 weights |
| verse.js | Verse study: text, key words, chapter, videos, journal note |
| journal.js | The journal (verse notes by day) |
| gear.js | Gear tab (dumbbell use comes from the program's weights) |
| me.js, data.js | Me tab; backups, restore, reading speed, reminders, cloud copy, test controls |
| fx.js | The burst when a block is done |

## Everything else
| Where | Owns |
|---|---|
| css/tokens.css | Every color, size, space, radius, height, layer order |
| css/app.css | One rule per component, token names only |
| sw.js | Offline copy of the app (SHELL list), update waiting, notifications (one shape; badge per kind) |
| icons/ | App icons; icon-*.png and badge-*.png are the reminder pictures and status-bar badges per kind |
| worker/src | The Worker: index.js (verses, videos, routing, cron), push.js (Web Push), sync.js (cloud copy) |
| tools/ | apply.ps1 (apply a patch, test, push, deploy), bump.mjs, cf.ps1, test-site.ps1, push-setup.ps1, sync-setup.ps1, instructions.ps1 |
| tests/tests.js | Unit and app-rule tests (node tests/tests.js) |
| tests/sweep.py | Layout, button and landscape sweeps in one browser (python3 tests/sweep.py) |
| test-site/ | The files swapped in for the test app (site.js, icons, manifest) |
| docs/ | PURPOSE (why), ARCHITECTURE (rules, data, release), CHANGELOG, this map |

## To change X, edit Y
- A step, cue, rest, weight, or video in a block: program/v1_1.js (new program version: a new file, see ARCHITECTURE)
- A reminder's hours, interval or follow-up: reminder-rules.js (the Worker redeploys itself from apply.ps1)
- What a habit is called or its amount: program/v1_1.js HABITS
- A new fact to count or total: log.js, then use it where it shows
- A new daily field: schema.js DAY_FIELDS (the form, import and export follow); handoff.js only for its line
- How a screen looks: css/app.css with a token from css/tokens.css; a new shared piece goes in ui/dom.js
- A notification's text or pictures: reminder-rules.js (text), sw.js (which picture), icons/ (icon-* and badge-*)
- A new verse: verses.js and data/original.json (key words; the tests check every bank verse has them)
- The cloud copy's lines: handoff.js buildHandoff (and the handoff template in the Project instructions)

## Build steps
1. Start from the live repo head. Read this map, then only the files the change touches.
2. Make the change. `node tools/bump.mjs X.Y.Z`. Add the CHANGELOG entry.
3. `node tests/tests.js` and `python3 tests/sweep.py`.
4. One patch: `git format-patch -1 --stdout --binary > telmyn-X.Y.Z-YYYYMMDD-HHMM.patch`, checked with `git apply --check` on a fresh clone.
