# Changelog

## 0.25.0 (2026-10-31)
Audit release: one source of truth, nothing new to learn. No change in how the app behaves except two fixes.
Fixes: meters pasted in from a chat handoff (no logged set) now show in the Endurance breakdown; the Day log's
Grip detail counts imported and app grip breaks together like everywhere else; the Gear tab's dumbbell line comes
from the program's weights (it said rows were 25s; they are 20s).
Structure: js/log.js answers every question about the log (grip breaks, leg habits, pulls, hangs, rowed, fluids) for
every screen, the handoff and the reminders, replacing 14 copies of the same filters. The kit pieces (bar, tile) and
text helpers (date labels, decode, plural) live once in js/ui/dom.js and js/clock.js, replacing seven copies.
Program v1 is folded into v1.1 (the only program in effect; one file to read). Voice stop and its 7 MB engine and
model are removed from the app (tag voice-stop keeps them). The three sweeps are one script, tests/sweep.py, run in
one browser at once (about a minute, was over two). docs/MAP.md says where everything lives and what to edit for
what; the CHANGELOG's first 90 entries are rolled into a summary. The toe touch note and the curl cue placeholders
are gone (Ross, 2026-10-31).
Notifications: the picture on the right of a reminder is now the kind's glyph in gold on graphite (gripper, foot,
rising arrow, scale); the app icon on the left is Android's and stays. The small status-bar badge is the same glyph.
Whether a reminder pops up and sounds is the phone's setting for Telmyn's notifications (Notification settings on
the alert, or Settings, Apps, Telmyn, Notifications): set it to pop on screen with sound.

## 0.24.1 (2026-10-31)
Meters rowed show at a glance. This Week's Endurance bar reads rows, minutes and meters, and the Endurance breakdown
says the amounts on each row ("Rowing 19 min", "Row distance 3,747 m") instead of "1 set" behind a tap. The meters
were always saved at the end of the row block; they were only hidden.

## 0.24.0 (2026-10-31)
Weekend calf raises, follow-up reminders, a badge per reminder, and study videos that keep going. Includes 0.23.4.
On Saturday and Sunday the Pumps pill becomes Calf (30 reps a set, Ross's change): tap logs a set, hold for the
list, and it has its own Day log tile, breakdown row and CALF_RAISES line in the handoff. Sets logged with Pumps on
a weekend before this update move to calf raises with their times (database version 2). Reminders: calf raises
hourly on weekends 08:00-17:00; any grip, pumps or calf reminder you leave unlogged comes again every 15 min, and
weight follows up every 15 min from 07:00 to noon. The rules live in one file (js/reminder-rules.js) that the app
and the Worker both use. Notifications keep the app icon; the small badge is now a gripper, a foot, a rising arrow or
a scale for the kind. Study videos: when one ends the next plays; when a block ends, where the video stopped is kept
and the next block picks up there (by itself if it was playing). The toe touch no longer asks for your reach, and the
STRETCH line drops it (older handoffs still read in). 0.23.4: minutes and meters rowed show in the Day log, and the
row distance's next-time step compares meters (it read "Beat 0").

## 0.23.3 (2026-10-30)
Meters rowed. The row block ends with Minutes rowed, then Meters rowed (from the monitor, +/- in steps of 10). The
distance shows in the Endurance breakdown and goes in the handoff as ROW_M, and a pasted ROW_M line fills it in for
a past day.

## 0.23.2 (2026-10-30)
Voice stop is shelved. One switch (VOICE_STOP in js/config.js) hides the mic button and the Voice stop screen and
keeps anything from listening, even if voice stop was left on. The code, the model and any recordings stay for
when it comes back.

## 0.23.1 (2026-10-30)
The Weight button's pulsing glow shows whole (the page cut it flat along the top). In video blocks, opening a
step's explainer centers it with the cue in its own box and grows it upward; Back and Done keep their size.

## 0.23.0 (2026-10-30)
Voice stop learns your voice (Me, Voice stop). Record 20 of your "stop"s as prompted, 20 seconds of your room (10
quiet, 10 talking), then Train: it learns your "stop" on the phone in about a minute and uses it from then on. The
recordings and the trained add-on stay on the phone (more stops can be added and trained again; Start over clears
them). The test meter and dial stay on the same screen. Includes 0.22.4 (say "stop" once).

## 0.22.3 (2026-10-30)
Voice stop no longer fires on room noise. A reading counted whenever "stop" scored past the mark, even when the
model's best guess was background noise, so quiet spikes stopped timers. Now "stop" must be the best guess, past the
mark, on two readings in a row (about a quarter second apart). The dial's meter uses the same rule.

## 0.22.2 (2026-10-30)
Voice stop dial (Me, Voice stop). A live meter shows how sure the model is that it hears "stop", with a mark at the
setting; slide toward Softer stop until your normal "stop" passes the mark. The setting is saved (85% to start,
50 to 95%) and blocks use it. Nothing is recorded; the mic closes with the sheet.

## 0.22.1 (2026-10-30)
tools/model.ps1 reads the model's words from either field the speech library accepts (this model lists them as
"words", not "wordLabels"), so the download no longer stops with "no stop word".

## 0.22.0 (2026-10-30)
Voice stop runs on the phone. It no longer uses Chrome's speech service (which sent audio to Google and chimed every
few seconds). A small open speech model (Google's speech-commands, which knows "stop") runs on the phone with
TensorFlow.js; the mic's sound is scored in memory and never stored or sent. The engine and model are Telmyn's own
files, cached for offline use and loaded only when voice stop is first used. Say "stop" ("done" is not one of its
words). tools/model.ps1 fetches the model into the repo once.

## 0.21.8 (2026-10-30)
Voice stop. A mic in a block's top bar turns it on (remembered). While a timer runs, saying "stop" or "done" acts as
the main button: a hang stops and saves what you held, a hold ends early, a rest ends. It listens only while a
timer runs, never during "Starts in". It uses the phone's speech recognition, so it needs a connection and the
microphone allowed for Telmyn. Includes 0.21.7.

## 0.21.7 (2026-10-30)
What was done and when, everywhere. Every stretch, hold and move finished in a block is now logged with its time
(and the seconds held). Opening any block in a breakdown shows its full timeline: each step and set in order, with
times, seconds, reps and weight. Mobility also lists every warm-up and cooldown done in the day's other blocks
(Fab Five, hangs, the row, strength, grip breaks), one row per block. Days before this update only have block start
and finish times.

## 0.21.6 (2026-10-30)
No more blinking. Today is redrawn every minute and after every change, and the verse was loaded fresh each time
(hidden, fetched, faded back in), with the weight button appearing a moment later. Today is now gathered first and
built complete before it shows, with the verse kept in memory, so a redraw changes nothing you can see. Ankle pumps
are 30 per foot (Ross's count), one number used by every screen and reminder; the server's reminder no longer names a
count.

## 0.21.5 (2026-10-30)
Grip and Pumps measure against your own days. Each pill fills toward your daily average first (plain fill, "5 / 7
avg"), then, once you pass it, fills green toward your best day ("12 / 15 best"), and reads "best" or "new best"
when you match or beat it. Days with none (weekends without grip breaks) are left out of the average.

## 0.21.4 (2026-10-30)
The video timer belongs to the top bar. In landscape it fills the room between the block's name and the Study button
and never reaches past either, the same height as the bar, leaving the video clear; in portrait it spans the full
width under the title bar, the count with a bar that takes the rest.

## 0.21.3 (2026-10-30)
Weight floats. The weight card is gone from the bottom of Today; a small Weight button floats in the header's corner,
level with the date, pulsing as the morning goes on, and disappears once today's weight is logged. Hold it for the
last 7 readings. It floats, so nothing moves when it goes.

## 0.21.2 (2026-10-30)
Update Ready can no longer loop. The tap now asks whichever version is waiting at that moment, and if it has not
taken over within 4 seconds the app drops the stuck copy and reloads, so the new version installs fresh. Tested with
a version that ignores the tap: one tap still lands on the new version.

## 0.21.1 (2026-10-30)
Update Ready shows up while the app is open. The phone only looked for a new version when the app opened; now it
also checks every 5 minutes and whenever you come back to the app.

## 0.21.0 (2026-10-30)
One look, every screen. The tab bar is on every full screen (compact on layers), replacing the Home button; blocks
keep ✕ and Home at the top, and video keeps only ✕. The top strip holds Fluids, Protein, Grip and Pumps; the bottom
chips are retired and Weight is a slim card on Today until logged, then a small tile with a green check. Huel lives
in Protein (it still adds its water) and is no longer a drink to pick. Quick amounts are your last 4 different
amounts, per drink for Fluids and in grams for Protein; grams show whole. A logged food no longer copies itself into
the eating notes, so it shows once; the handoff builds EATING from the entries. Breakdowns use the Fluids and Protein
row (time, what, amount), a green check when a target is met or a block is done, a meter toward each target, a
green "up" tag when a session beats the last one, and notes behind their own line. Today's date sits above a
centered day title ("Row Day"); every tab's header has the same form. In landscape video the timer sits centered
and large between the title and the step.

## 0.20.1 (2026-10-30)
No more jumping text. Today's verse was measured while its card could squeeze it, so its size flipped between visits
(30 px one time, 21 the next); it is now measured whole, fitted before it shows, and fades in at its final size.
Switching tabs builds the new tab off screen and swaps it in whole instead of showing an empty page that fills.
Fonts keep their own cache across updates (they were dropped with each version, so every update opened with the
stand-in font and jumped when the real one arrived), and text waits for its font instead of swapping. Windmills log
their weight (20 lb to start).

## 0.20.0 (2026-10-30)
Weights. Dumbbell sets log their weight: the step shows it with −5 and +5, starting at your last session's weight
(to begin: 25 lb for RDLs and squats, 20 lb for rows and curls, Ross's call; step texts no longer name a weight).
Every set step shows what you did: the set before it today and the same set last time, with reps and weight, and
starts the count at that number. Weights print in
the handoff and the breakdowns, and the next-time steps use them. Next time now reads at a glance: one row per
exercise with a short step, in the same name-and-detail look as This week. A Home button sits on every layer, in
the block runner and in video blocks: one tap closes everything and goes to Today. No more flash of giant buttons
when a block opens (each part of the runner now has its own row, so the study bar loading late moves nothing).
Restore takes several days in one paste, keeps every pasted handoff text for a day, and no longer drops imported
sets the paste does not mention.

## 0.1.0 to 0.19.4 (2026-10-27 to 2026-10-30), in short
90 releases over the first days. Foundation: on-phone storage with migrations, program v1 then v1.1 (warm-ups and
cooldowns, cues), Today, the block runner with chained timers and hang stopwatches, quick logs, the daily log form,
handoff import and export, backups, the test app with its fake clock. Verses from Bible Gateway through the Worker,
verse study with Greek and Hebrew key words (STEPBible), study videos and chapter reading while you train, favorites,
the journal. Fab Five as Gator's daily video. Push reminders through the Worker. Progress (This week), Gear, Me, the
Day log and the breakdowns. The design system (tokens.css, one rule per component) and the tests that guard it. The
full text of these entries is in the git history of this file before 0.25.0.
