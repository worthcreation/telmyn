# Changelog

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
