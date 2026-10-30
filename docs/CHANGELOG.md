# Changelog

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

## 0.19.4 (2026-10-30)
A past day's sets can be filled in or fixed from a short handoff pasted into Me, Restore. Each exercise line in it
replaces that exercise's sets for the day (sets logged in the app included, so nothing is counted twice); exercises
it leaves out, warm-up sets, hangs and everything else on the day stay as they were.

## 0.19.3 (2026-10-30)
Update Ready now really waits. App files come from the version in charge instead of the network, so new code no
longer runs before the tap (that is why Me already showed 0.19.2 while the card sat on Loading). If the reload
signal never arrives after the tap, the app reloads itself after 4 seconds. Grip and pumps toasts say what was
logged, with the count today underneath and Undo.

## 0.19.2 (2026-10-30)
Every notice is centered. Toasts and the update card appear in one stack at the same spot as the video title card,
so they never cover each other.

## 0.19.1 (2026-10-30)
Updates wait for you. A new version downloads in the background and loads only when you tap the Update ready card
(or after every Telmyn window has closed); before, it loaded by itself. A waiting update is offered again the next
time the app opens. Toasts, the update card and the video title card now share one look, the frosted card.

## 0.19.0 (2026-10-30)
Everything on This week and the Day log opens a breakdown at the level you are on. On This week, a bar or average
opens that area for the week, day by day, each day linking to its Day log. On a Day log, every block circle, bar
and tile opens that area for the day. Rows say only what was done; tap one for its sets, reps and times. Strength,
Endurance and Grip open with how to push next time, from the progression rules and your last session of each
exercise (one step shown, the rest behind a tap). Edit this day sits at the bottom of every day breakdown. Tests now
print one line per group (Program, Data, Verses, Reminders, App rules) and name only failures.

## 0.18.1 (2026-10-30)
Every rep and time reaches the cloud copy. Sets saved nothing when Save was tapped on the grey number carried over
from the last set; that number is now a real value, so what shows is what is kept, and an empty box cannot be saved
(enter 0 for a set not done). The handoff now prints every exercise in its own line (scapular pull-ups and warm-up
hangs on strength days, push-ups, paused push-ups, single-arm rows per arm, goblet squats, magnet and champagne
curls, windmills), pull-up modes set by set, per-side sets in full, ankle pumps, and each block's finish time.
The Verse journal shows only the verse and the note; the videos watched that day are listed on that day's Study page.

## 0.18.0 (2026-10-30)
Day log looks like This week. One day on one screen: a circle per block (filled when done, with its finish time),
then bars against the targets (the day's routine, Grip with hangs, Fuel, Hydration), Spirit with the verse note,
and tiles for weight, pumps and sleep. Arrows step between days. Tapping a row opens where it is edited (today's
Fuel and Hydration open the Protein and Fluids lists); Edit this day opens the full form. Tapping a day on This
week opens the same view. Also restores 0.17.8, which was never pushed: the study video keeps playing once started
and only you pause it.

## 0.17.10 (2026-10-30)
Project instructions handling. tools/instructions.ps1 takes the newest telmyn-project-instructions-*.md from
Downloads, keeps a dated private copy in .cfhome\instructions (never in git: the repo is public), and puts it on the
clipboard to paste into the Telmyn Project. apply.ps1 runs it after every push; with no new file it says the
instructions are unchanged. Run it alone any time to copy the latest again.

## 0.17.9 (2026-10-30)
Gator's daily video: the newest upload that has not been shown in the last 13 days, so the same video never plays
two days in a row and none repeats until 13 days have passed since its last day (it can return on day 14). If every
recent upload is inside that window, the one shown longest ago plays. The Worker now returns the recent uploads with
lengths; the app keeps the day's pick and a record of when each video was last shown (seeded from earlier days).

## 0.17.7 (2026-10-29)
Video lengths. Every video list from the Worker now carries each video's length, from one shared details lookup
(1 API unit per list); the passage search's own lookup folds into it. The video card shows the length on its last
line, and the study video lists show it after the channel. Video caches are versioned so lists saved before this
are fetched again with lengths.

## 0.17.6 (2026-10-29)
Video mode, tightened. The timer moves to the top: under the step tracker in portrait, centered between the title
and Study in landscape, as a compact pill with its bar. The bottom band is only the step name and Pause / Done,
the step card as wide as the buttons in portrait and the same height as them in landscape. The timer has one slot
per mode (top in video mode, in the step otherwise), and switching modes redraws it.

## 0.17.5 (2026-10-29)
Reminders always say what is due. A push used to arrive empty and the phone then asked the Worker what to show; the
Worker had just written that to KV, which can take up to a minute to reach other locations, so the phone sometimes
found nothing and showed "A reminder is due." The reminders now travel inside the push, encrypted for this phone
(Web Push aes128gcm, RFC 8291), and /push/pending is gone. A test decrypts a payload the way a phone does. The test
runner now waits for async tests.

## 0.17.4 (2026-10-29)
Reading voice becomes Reading speed. Tested on the phone: browsers on Android list one entry per language and speak
with the voice set in Android's text-to-speech engine, so the in-app voice list could not change the voice. It is
removed; the speed buttons stay, and the note says where the voice is set (preferred engine and its voice, then
force stop Brave once).

## 0.17.3 (2026-10-29)
Video mode keeps to a top band (title, Study) and a bottom band (step, timer, buttons); the middle is the video's.
The timer now sits beside the step text in the bottom band, in both orientations. It used to be a separate chip
whose position a broader video-mode rule overrode, so it fell below the screen in portrait and into the middle of
the video in landscape; that chip is gone. Messages show in the middle while a video plays. Reading voice on Me:
pick any English voice the phone has and a speed (0.8x to 1.25x); Listen uses it. Kept on the phone.

## 0.17.2 (2026-10-29)
Press and hold Grip, Pumps or Weight for its list, full screen like Fluids and Protein. Grip and Pumps: today's
entries with their times (grip with palms), each removable with Undo that puts it back at its original time.
Weight: the last 7 readings with dates and the 7-day average. A tap still does what it did; a hold never also logs.

## 0.17.1 (2026-10-29)
Fluids and Protein open full screen: the total against the target, quick adds, and today's entries with their times,
newest first. Adding keeps the screen open so the entry shows in the list. Any entry can be removed (drinks with
Undo; a food like Huel removes its protein, water and note together). Protein added by hand is now a timed entry
that moves the total with it; a total set by hand in the Day log stays, and the list shows the difference as its
own line. Unused undoFluid removed.

## 0.17.0 (2026-10-29)
Verse repeats build on the first time: when a verse comes back in its 5-week rotation, its Study page shows what you
wrote the last time it came up. Me cut from nine controls to six: Back up (one file; Copy full record folded in as
its fallback), Restore (one way in: a backup file, or pasted text that is a backup or a handoff; Import a handoff
folded in), Reminders, Cloud copy, one status line, version. Copy today's handoff removed: chats read the cloud copy,
and a past day's handoff now reads "day complete" by its date unless set otherwise in the Day log. The reminders
explainer line is gone (the heartbeat pulse shows what is due). Test app starts at #today like the real one.

## 0.16.4 (2026-10-29)
Launch splash and system bar colors. Brave (Chromium) keeps a home-screen web app's splash image and colors in a
store keyed by its start address, and re-adding the app reused that store: the launcher icon was refreshed, the
stored splash (the original track icon) and the install-day colors were not. start_url is now ./#today (Today is
the opening tab anyway), which gives the app a fresh entry on the next add. Nothing else changes; the sign-in link,
service worker and data all live on the same origin.

## 0.16.3 (2026-10-29)
Notification audit. Android draws the small status-bar badge as a white silhouette of the image it is given, and
Telmyn was giving it the full app icon (a dark square with a star in it), which showed as a white square. New
icons/badge-96.png is only the star shape, cut from the real icon. Notifications are now shaped in one place: the
service worker. The page's own in-app checks ask the service worker to show theirs, so push alerts and in-app
alerts can never drift apart. The old launch splash and the white system bar when opening from an alert are the
installed Android package (WebAPK) still carrying the manifest from install day; the repo is already right, and
Chrome rebuilds the package on its own schedule or on request from chrome://webapks.

## 0.16.2 (2026-10-29)
Tab bar fixed at the source. The app was sized with 100dvh, and Chrome on Android can resolve that taller than the
real window after a reload (every update) or a keyboard, so the bottom of the app, the tab bar, sat under the system
buttons. The phone's own report after the 0.16.1 update showed it: window 749 px tall, with the buttons outside it.
The app now fills exactly its real window (height 100%), and the guesswork built around the symptom is gone: the
measured button-space fallback (0.15.x) and the manual button-space switch (0.16.1). The screen report sent with the
cloud copy now shows window, app and 100dvh heights side by side.

## 0.16.1 (2026-10-29)
Due reminders pulse on the item they are about (Grip in the top strip, Pumps and Weight on Today) with a slow
heartbeat glow: soft at first, then faster, wider and deeper red at a half hour and an hour past due (weight at 9 am
and noon). Button space above Android's buttons can be forced: tap the version line on Me to cycle auto, on, off.
Each synced day now carries the screen measurements, so Claude can see why the tab bar drops on this phone. Icons
renamed (star-*.png) so Android notices the new icon and replaces the old launch splash.

## 0.16.0 (2026-10-29)
Cloud copy, so Claude can read the log. Each day you change is sent to the Worker (Cloudflare D1) five seconds after
you stop tapping, at once when Telmyn goes to the background, and again later if a send fails. Claude reads the last
7 days as handoffs from one private link pasted into chat. Two keys: the write key lives only on the phone, the read
key is in the link, and neither can do the other's job. The test app never sends. Me shows Cloud copy on or off (tap
to resend every day) and when it last sent. One-time setup: tools/sync-setup.ps1 (database, keys as Worker secrets,
deploy, a QR code for the phone, the read link on the clipboard). Phase 3 turns this into a Claude connector.

## 0.15.2 (2026-10-29)
The tab bar no longer drops under Android's buttons after a keyboard, a permission dialog or a call banner. The space
kept for the buttons is decided from the window's full height (those moments only shrink it briefly), and the phone's
own button-area report is now read correctly (the old probe could never see it).

## 0.15.1 (2026-10-29)
Verse study has two pages, Verse and Study, so long passages fit without scrolling: Verse is the text with every word
tappable and the word panel; Study holds where it was applied, the whole chapter, and the videos (first three with
hearts, then All videos). Landscape shows both side by side. Today's card says "tap to read all" when a passage is too
long to show whole. Fab Five's video now flows into the block's cooldown (doorway chest and forearm stretches), which it
had been skipping. Focus rings on text boxes sit inside the box, so no container can clip them.

## 0.15.0 (2026-10-28)
Push reminders that arrive with Telmyn closed. The Worker checks every minute (Cloudflare's shortest schedule) and sends
an urgent push when something is due: grip break 60 minutes after the last, ankle pumps after 30, weekdays 8 to 5;
weight once from 6 am when nothing is logged. The phone shows them through Android's notifications for Telmyn, with
sound and vibration, until dismissed. Only the push address, the time zone offset and the last grip, pumps and weight
times go to the Worker. One-time setup: tools/push-setup.ps1 (KV namespace, VAPID keys as Worker secrets, deploy).
In-app checks remain as the fallback when push is unavailable.

## 0.14.0 (2026-10-28)
Study while you train has three ways in: watch a video on the day's verse, read its chapter on a glass panel (today's
verses marked), or listen to the verse and chapter read aloud by the phone; each follows the block (plays during timers,
holds while the app waits on you). The video overlay is minimal: the block's ✕ and name on the left, one Study button on
the right for every choice, the video always shown whole; the Show whole video and rotate buttons are gone because the
app now turns with the phone. A large centered card shows what is playing whenever a video starts or changes.
Favorites: a heart on every video in the workout picker and the verse study list; favorites rank first and their
channels rank higher everywhere. Videos watched for 30 seconds go in that day's journal entry. Reminders vibrate and
sound, stay up until dismissed, and chime with a message when the app is open.

## 0.13.0 (2026-10-28)
Landscape: every screen uses the width. Today puts the verse on the left and the next block, the day and the quick chips
on the right; Progress puts the week and averages beside the stats; Gear is a 2-by-2 grid; Me's buttons sit in two
columns; the verse study puts the verse beside the word panel. The status strip and tab bar are slimmer sideways.
Checked at 915x412 and 800x360 (tests/landscape_sweep.py). Layers now open above a running block.
Workout videos: the "Study while you train" card says how many videos there are and opens a picker with every study
video for the day's verse (the same list as the verse study, grouped the same way). While a video plays, a swipe that
crosses the middle of the screen moves to the next (right to left) or previous video; a tap plays or pauses.

## 0.12.8 (2026-10-28)
Descenders stay whole: the g in "Dead hangs" was cut off because display text used a line height of 1 inside a box that
clips. Nothing uses a line height of 1 now (the tightest is 1.15, a token), and a guard test fails any release that adds
one back.

## 0.12.7 (2026-10-28)
No text crowds or clips inside a button. Quick chips share the row by their content, so a longer label gets more width,
and keep 8 px inside each edge; the Start button's name scales with the screen width instead of cutting off. A new
button sweep checks every button on every screen at 360 and 412 px wide before each release.

## 0.12.6 (2026-10-28)
Today makes room for the whole verse: the day list's rows scale with the screen's height, and on phones up to 800 px the
next card's buttons and ring and the quick chips are a little shorter. The verse no longer cuts off with "…" at any
height from 700 to 915 px. The layout sweep now also checks for a clipped verse.

## 0.12.5 (2026-10-28)
Fixes 0.12.4's button-area check, which missed the common case (app under the buttons but below the status bar) and let
the tab bar slide under the buttons. Now: if the phone reports the button area, use it; otherwise reserve 48 px when the
app's height falls short of the screen by less than 45 px (only the status bar), else nothing. The test app's Me tab
shows the numbers.

## 0.12.4 (2026-10-28)
The space kept for Android's system buttons is measured, not assumed: it is reserved only when the app is drawn behind
the buttons, and rechecked whenever the window changes. Before, a fixed 48 px was always added, which left a gap at the
bottom and pushed everything up once Chrome started keeping the app above the buttons itself. The test app shows the
measurement on Me.

## 0.12.3 (2026-10-28)
Every page checked at eight phone heights (640 to 915 px): nothing scrolls, nothing sits under the tab bar, nothing
clips sideways. Spacing now scales with the screen's height (one token, --gap-v), so pages breathe on tall phones and
fit on short ones. Progress spreads its rows over the space; Gear cards share it; Me's buttons spread evenly; the Me
footer is one line. tests/layout_sweep.py is the sweep, run before every release.

## 0.12.2 (2026-10-28)
Every quick chip and the Grip pill carry their state: red when behind or overdue, green when met, plain when on
track. Fluids and protein are judged against a pace line through the day (fluids 7 am to 11 pm, protein 7 am to 9 pm)
with some slack; pumps and grip by time since the last one on workdays; Huel green once had; weight as before.
One module (status.js) makes these calls, and the reminders use the same ones.

## 0.12.1 (2026-10-28)
Weight is a chip in Today's quick row (red when a day or more old), not a full row. Its entry sheet is compact: a big
number box prefilled with the last reading, half-pound nudges, the last reading's date, Save or the keyboard's Go.

## 0.12.0 (2026-10-28)
Grip break moves into the top strip: the Grip pill is the button, its arrow shows the next palms, Undo on the message.
Its old row on Today is now Weight: last reading and how old it is (red past a day), tap to enter today's. Reminders
(Me tab, off by default): grip break after an hour, ankle pumps after 30 minutes on a workday, weight once a day; only
when overdue, nothing when you are on track; they run while the app is open or in the background (alarms with the app
closed are phase 2). The next block card is plain blue (the lane stripes are gone). Today's verse gets real room again.

## 0.11.3 (2026-10-28)
Hangs keep counting after the target beep; the time saved is what was actually held, when you drop and tap Stop.

## 0.11.2 (2026-10-28)
Leaving a block no longer asks anything. ✕ and the back gesture mean the same thing everywhere: close this, record
nothing. A block left mid-way remembers its step and resumes there (Today's button says Resume); a block already
counted at its cooldown simply closes as done. Skip stays on Today; Done comes from finishing.

## 0.11.1 (2026-10-28)
No drop shadows on buttons or chips. A press now shrinks the control slightly (one token, --press) and darkens it.
Today's verse refits after the serif font loads, so it no longer ends in … when there is room.

## 0.11.0 (2026-10-28)
One design system for the whole app. tokens.css now holds everything the look is made of: one type scale (12 sizes
with names, from micro to clock), line heights, control heights, glass tokens for over-video controls and the layer
order; app.css is rewritten from scratch as one rule per component (455 lines, down from 891) with no layered
overrides, two size conditions (short screens, landscape) instead of 21, and only token names for sizes and colors.
One shared fitText routine in dom.js sizes the Today verse and the study verse. Shared pieces got one name each
(chip, tile, card, lbl). Four guard tests fail any release that uses a size outside the scale, a color outside the
tokens, defines a selector twice, or fits text anywhere but the shared routine. No visual redesign: every screen was
compared before and after at three phone sizes.

## 0.10.11 (2026-10-28)
Verse study: the word panel's content is centered vertically; the verse refits after the serif font loads, so the
citation is never clipped.

## 0.10.10 (2026-10-28)
Verse study fits with no scrolling: the lead video is a slim row (what it covers, who made it, its title, and More),
no picture; the verse takes the room that is left, type stepping from 30 down to 18 px only as needed.

## 0.10.9 (2026-10-28)
Writing fields at rest show one whole phrase of what was written, with "…" before and/or after when there is more
("… to come the wise person and presence he has called me to be. …"), never a line cut off under the edge. Read-only
fields open the full text. The writing layer's focus ring is clean.

## 0.10.8 (2026-10-28)
Word panel: nothing clips (long words wrap beside a fixed stepper; grammar wraps). Every word now shows its place in
the Greek or Hebrew order, two words each side read literally ("he should ask from [the One] giving God"), each one
tappable. Words the English has no separate word for say so plainly instead of pointing at nothing.

## 0.10.7 (2026-10-28)
Verse study: every word or phrase with a translation behind it shows the same quiet dotted underline, so you can see
what is tappable; nothing is selected until you tap, and the tapped one turns gold.

## 0.10.6 (2026-10-28)
Verse study: the verse reads as plain text with nothing highlighted until you tap a word; then that word (or phrase)
is marked and its Greek or Hebrew shows below. Before a pick, the panel says how to start or steps through every word.

## 0.10.5 (2026-10-28)
One layer system for the whole app: every sheet and full-screen view (verse study, chapter, videos, journal, Day log,
fluid and protein, import, test controls) is frosted glass over the app, sized to the visible screen so the keyboard
never covers it, and ✕ or the back gesture closes only the top layer. Writing anywhere (where the verse was applied,
Day log notes) opens one roomy writing layer instead of a squeezed box. Verse journal entries open that day's verse
study (verse, words, video) with what was written, read-only.

## 0.10.4 (2026-10-28)
Verse study fills the whole screen with nothing scrolling and nothing left empty. The verse starts large (26 px) and
gives up size only until the lead video's picture has a useful height; the lead video takes all remaining room, with
what it covers shown on the picture and "More videos" on its title row. The note box is one line until tapped.
The compact layout now applies only to genuinely short screens (680 px and under), not to normal phones.

## 0.10.3 (2026-10-28)
Verse study opens full screen over the app (slightly see-through, back gesture closes it). Every key word now sits
inside the verse: words a version translates differently are fitted to the right words in the text by their
neighbors ("generously" is NKJV's "liberally", "finding fault" is "without reproach"), so nothing hangs after the
verse. Small words are clearly tappable too, and the panel shows meaning, the literal English and how the version
words it. Videos: teaching on the exact passage from any teacher whose title names it (trusted Bible teachers ranked
first, no Shorts, new Worker route /passage), then BibleProject; one shown large, the rest under a full-width
More videos. Chapter is a small chip next to the version picker; the picker has proper padding and its own arrow.

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
