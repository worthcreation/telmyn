# Changelog

## 0.1.1 (2026-10-27)
Fix: a stray "null" printed at the top of Today (and in the fluid sheet) when a conditional item was empty.
Fix: blocks marked done in an imported handoff now count as done on Today.
Fix: imported fluid and hourly totals carry forward when more are logged in the app (no double counting on re-import).
Added .gitattributes so Windows and Mac keep the same line endings.

## 0.1.0 (2026-10-27)
Foundation: storage with migrations, program v1, today screen, block runner with auto rest timers,
quick logs, schema-driven daily log, verse card, handoff import and export, backup export and restore, test mode, tests.
