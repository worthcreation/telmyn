# Changelog

## 0.4.5 (2026-10-27)
Clearer cues for the doorway chest stretch (field goal arms, step through, bend the front knee), hamstring stretch,
and lunge hip stretch.

## 0.4.4 (2026-10-27)
Hangs are real timers now: "Starts in 5" to get on the bar, then a big clock counting up. One beep at the minimum
(10 sec), double beep and auto-save at the top (20 sec), or tap Stop and save to drop early. On-screen text explains the beeps.

## 0.4.3 (2026-10-27)
Handoff import: a newer handoff now updates the day (its values replace stored ones; blank lines change nothing).
App-logged blocks, sets and drinks are still kept, and app-logged fluids and hourly blocks are never double counted.

## 0.4.2 (2026-10-27)
No page scrolling and no visible scrollbars. Today: done blocks collapse into one line, hourly is one compact row
(count, arrows, Done, other palms, Guided), smaller next card and counters, and spare space shows today's verse text.
Checked on 360, 390 and 411 px wide screens with the Android bottom reserve: everything fits.

## 0.4.1 (2026-10-27)
Release workflow: git patches applied by tools/apply.ps1 (sync, apply, test, push, clean up Downloads),
tools/bump.mjs sets the version in both files, and the tests fail if version.js and sw.js disagree.

## 0.4.0 (2026-10-27)
Today uses the whole screen: compact next card, the full day list with times, an hourly strip showing every block's palms
(imported and logged) with one-tap "Done, palms ↓/↑" that alternates for you, and three counters.
Android: space reserved for the system buttons so Log and Data never sit under them.

## 0.3.3 (2026-10-27)
Fix: phones kept running cached files after a release (the version number itself was cached).
App files now load network first with the cache as offline fallback, and a new service worker takes over immediately.

## 0.3.0 (2026-10-27)
Verse text in the app from Bible Gateway (personal, non-commercial use), any version Bible Gateway offers,
choice remembered, each verse cached on the phone for offline use. Served through the telmyn-api Cloudflare Worker (worker/).
Bottom system area (Android buttons, iPhone home bar) matches the app background; nothing interactive sits there.

## 0.2.1 (2026-10-27)
Hang stopwatches beep at the target (10 and 20 sec on hang sets) and stop themselves (15 sec in the strength warm-up).
Flow: tap Start once and timed steps chain. Each gets a transition countdown (0 sec if you don't move, 5 to switch sides,
10 for a new position), 3-2-1 ticks, a held tone at the start, a double beep at the end. Pause and Start now on every timer.
Hourly block: the 5 sec squeeze holds are now their own timed steps. Forearm stretch video added (starts at 0:36, approved by Ross).

## 0.2.0 (2026-10-27)
Program v1.1 (effective 2026-10-27, Ross's request): warm-up before and cooldown after every round
(Fab Five, hangs, row, hourly blocks; strength days already had both), a short cue on every step,
hangs before the routine except on strength days. Runner labels warm-up and cooldown steps and shows the cue.

## 0.1.1 (2026-10-27)
Fix: a stray "null" printed at the top of Today (and in the fluid sheet) when a conditional item was empty.
Fix: blocks marked done in an imported handoff now count as done on Today.
Fix: imported fluid and hourly totals carry forward when more are logged in the app (no double counting on re-import).
Added .gitattributes so Windows and Mac keep the same line endings.

## 0.1.0 (2026-10-27)
Foundation: storage with migrations, program v1, today screen, block runner with auto rest timers,
quick logs, schema-driven daily log, verse card, handoff import and export, backup export and restore, test mode, tests.
