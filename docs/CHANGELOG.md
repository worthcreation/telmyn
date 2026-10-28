# Changelog

## 0.10.2 (2026-10-28)
Verse study: every word is reachable. Key words stay highlighted; every other word that maps to an original word is
tappable too, and the word panel steps through every original word in order (‹ ›, "7 of 19"). Videos: the BibleProject
book overview is the one shown; their videos on the verse's main word sit behind "More videos". More room between parts.

## 0.10.1 (2026-10-28)
Verse study rebuilt as one screen that goes deeper than the Today card instead of repeating it: the verse with its key
words highlighted in the text (tap one for the Greek or Hebrew word, transliteration and meaning, shown right under the
verse; key words a version words differently appear as tap targets after it), the chapter in its own reading sheet with
today's verses marked, BibleProject videos (the verse's main word, then the book overview) played in the in-app player,
and where it was applied today. Study videos are BibleProject only; the other creators were often off the passage.

## 0.10.0 (2026-10-28)
Videos YouTube won't play inside the app (the library's Shorts) can be replaced on the spot: the player offers
"Find one that plays", searches through the Worker for videos that are embeddable, allowed outside YouTube and
4-20 minutes long (never Shorts), and the one Ross taps plays and becomes that exercise's video from then on
(meta video_picks, kept in backups). New Worker route /search (cached 30 days).

## 0.9.9 (2026-10-28)
Today's verse is always on Today, right under the date, in its own card that takes the spare space. Type shrinks to fit;
a long passage ends with … and tap opens it. It refits whenever its space changes, so it can no longer vanish.
Audit UX fixes: Progress fits short phones; Sunday offers the optional walk; copying the handoff offers to mark the day
complete; the Me tab shows how old the last backup is (warning after 7 days); the Day log has 5 tabs (Day, Body, Fuel,
Watch, Notes) instead of 8; template choices left in a pasted handoff ("none / squeeze / sharp") are not imported.

## 0.9.8 (2026-10-28)
Video playback: every YouTube video uses the privacy-enhanced player with the app's origin declared. When YouTube
refuses a video, the app says so in its own words and logs it (meta video_errors) for replacement; Fab Five falls
back to its steps. Audit fixes: the Worker answers only Telmyn (Origin or Referer check), so nobody else can spend
the YouTube quota; backups hold your data and settings only, not cached verse text or video lists; the import note
now matches what import does; roadmap text removed from the Me tab. New tests: every app module is in the offline
cache list, and every release is in this changelog. README, ARCHITECTURE and verses.js comments brought up to date.

## 0.9.7 (2026-10-28)
Watch buttons play in a full-screen in-app player (YouTube, Shorts, Facebook), never another site; opening one
pauses a running timer. Landscape switch (⟲) on every video; Row and Legs up open their study video sideways.
Watch buttons redesigned as quiet pills. Tests: every library video plays in the app, no link opens another site.

## 0.9.6 (2026-10-28)
Fab Five is the newest video from Gator's channel: full screen, two small controls, done when the video ends,
steps as the offline fallback. Video overlays reduced to one slim card (tap for the cue). The hourly block is now
"Grip break": one button, next palms in the alternation, Undo.

## 0.9.5 (2026-10-28)
Separate test app at telmyn-test.pages.dev (own address, icon and storage), deployed by tools/test-site.ps1 after
every push. The real app has no test mode. Test: the real app always ships as live.

## 0.9.4 (2026-10-28)
Worker /daily: newest upload from a fixed channel (Gator), cached one hour; Fab Five shows it.

## 0.9.3 (2026-10-28)
One-tap Huel (protein, water and eating note together, with Undo). Day log for any date, with blocks markable
after the fact. Guided blocks count as done once the cooldown starts; the back gesture asks before leaving.
Progress: Hydration bar, weekly averages, tappable days.

## 0.9.2 (2026-10-28)
Export backup works on Android (shares as plain text); Copy full record added.

## 0.9.1 (2026-10-27)
Video mode: once the study video starts, it fills the screen behind the block. The timer floats as a frosted-glass
chip in the upper-left corner; the step, its instructions and the buttons sit on frosted glass at the bottom;
"Show whole video" letterboxes it over a blurred backdrop, "Fill screen" goes back; ✕ closes the video.

## 0.9.0 (2026-10-27)
Study while you train: inside any block, a bar offers a Bible study video on today's verse (your chosen creator).
Once you start it, it plays while timers run, pauses when the app waits on you (reps, logging), and its volume dips
for every beep. Your own pause or play always wins. The runner keeps the video between steps.
Clearer step names and cues (row segments, damper, cat-cow, lunge, palms, Fab Five), long step names size down to fit,
the app stays portrait when installed, and landscape no longer overlaps.

## 0.8.4 (2026-10-27)
Today: the verse fits the space that's left. Its type shrinks until it fits, and if it still can't fit it steps aside
instead of being cut off.

## 0.8.3 (2026-10-27)
Next card: the button carries the block's name ("▶ Row") instead of "Start"; above it, a one-line summary of what the block
involves and what comes after it.

## 0.8.2 (2026-10-27)
Next card in two columns, each centered on its own: the block and Start on the left, the day ring and Skip on the right.

## 0.8.1 (2026-10-27)
Verse journal: a Save button for where the verse was applied today, and a Journal of every day's verse and
application, newest first (also opens from Spirit on Progress). Study videos: main English channel only, and only
videos whose title names the book.

## 0.8.0 (2026-10-27)
Study tab in the verse card: Bible teaching videos on the verse from BibleProject, Look at the Book (Desiring God),
Mike Winger, or GotQuestions, found through the YouTube Data API (key kept as a Worker secret), filtered to each
creator's own channel, cached 30 days, and played inside the app. Centering pass: status numbers, the next block,
the verse, timers and sheet titles centered; lists and reading text stay left-aligned.

## 0.7.3 (2026-10-27)
New app icon from Ross's John 17 star: the Star of Bethlehem with 7 rays, every ray a different length, the longest
pointing down so it reads as a cross, gold with a soft glow on graphite.

## 0.7.2 (2026-10-27)
Next-block card 23% shorter (185 to 143 px on a 411 px wide phone): one-line title, smaller ring, tighter padding.
The freed space goes to the rest of the day and the verse.

## 0.7.1 (2026-10-27)
Fix: today's verse is highlighted again in Context (its styles were lost in 0.6.0). Header redesigned with room to
breathe: day type as the title, "Tue, Oct 27  Week 1, Day 1" under it, verse pill centered beside it; same header
shape on every tab; more space between sections.

## 0.7.0 (2026-10-27)
Tabs: Today, Progress, Gear, Me, with a status strip on every tab (fluids, protein, hourly as labeled fill bars).
Today: day ring on the next card (blocks done of the day), quick adds for ankle pumps, fluid, protein.
Progress: this week from real logs, bars only where the program sets a target; Spirit shown as history, not a score.
Gear: grippers, dumbbells, pull-up bar, rower, with what's in use and the rule for moving up.
Me: today's log, handoff, backups. Graphite palette (blue for the main action, gold for the verse, green for done),
chunkier buttons with a pressed state. Fix: the service worker had a syntax error since 0.5.0 (updates still loaded
through the older worker); a test now checks it parses.

## 0.6.0 (2026-10-27)
Verse card: Context is the whole chapter (today's verse highlighted and scrolled into view); the 3-verse view is gone.
Greek / Hebrew is now an interlinear: every word in order, original over its English in this verse, key words
stand out; tap any word for transliteration, how it reads here, dictionary meaning, and grammar in plain words.

## 0.5.2 (2026-10-27)
tools/cf.ps1 runs Wrangler with Telmyn's own Cloudflare sign-in (telmyn/.cfhome), separate from NFC's; apply.ps1 deploys through it.

## 0.5.1 (2026-10-27)
Worker pinned to the personal Cloudflare account (account_id in wrangler.toml), so it can't deploy to NFC's.

## 0.5.0 (2026-10-27)
Verse card shows everything in the app, no outside links: Context (surrounding verses), Chapter (the whole chapter,
today's verse highlighted), and Greek / Hebrew key words for every verse in the bank (word, transliteration, meaning),
built from STEPBible.org data (CC BY 4.0; NT words follow the Textus Receptus, the NKJV base).
Verse service accepts whole-chapter references. apply.ps1 deploys the verse service when an update changes it.

## 0.4.8 (2026-10-27)
Updates are one cumulative patch file; apply.ps1 uses only the newest and clears the rest.

## 0.4.7 (2026-10-27)
Copyright line removed from the verse card (Ross's call; personal use).

## 0.4.6 (2026-10-27)
Verse card rebuilt: verse, reference (tap to open Bible Gateway), short copyright line inside the verse block,
Context shows the surrounding verses in place with today's verse highlighted, Full chapter and Greek / Hebrew links,
and one line for where it was applied. Removed the placeholder sections, the duplicate button and the footer.

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
