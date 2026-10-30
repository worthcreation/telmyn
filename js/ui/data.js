import { h, sheet, toast, fill } from './dom.js';
import * as db from '../db.js';
import { importDay } from '../state.js';
import { parseHandoff } from '../handoff.js';
import { APP_VERSION } from '../version.js';
import { remindersOn, setReminders } from '../remind.js';
import { TEST, SPEED, isoDate, hhmm, now } from '../clock.js';
import { voiceSettings, setRate, utterance, RATES } from '../voice.js';
import { syncKey, syncLast, syncAll, syncDates } from '../sync.js';

// Android only shares certain file types, so the backup goes out as plain text with a .json name.
// Returns 'shared', 'cancelled', 'downloaded' or throws.
async function shareOrDownload(name, text) {
  const file = new File([text], name, { type: 'text/plain' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return 'shared'; }
    catch (err) { if (err?.name === 'AbortError') return 'cancelled'; /* otherwise fall through to download */ }
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'downloaded';
}

async function backupText() {
  const data = await db.exportAll(APP_VERSION);
  await db.setMeta('last_export', new Date().toISOString());
  return JSON.stringify(data, null, 1);
}

// Back up: one file with everything (share sheet, or Downloads). If neither works, the text goes to the clipboard.
async function backUp() {
  let text;
  try {
    text = await backupText();
    const how = await shareOrDownload(`telmyn-export-${isoDate()}.json`, text);
    if (how === 'downloaded') toast('Backup saved to Downloads');
  } catch (err) {
    try { await navigator.clipboard.writeText(text ?? await backupText()); toast('Backup copied as text'); }
    catch { toast(`Backup failed: ${err?.message || err}`); }
  }
}

// Restore: one way in for everything. A backup file, or pasted text that is either a backup or a chat handoff.
// A backup merges every record; a handoff updates that one day (blank lines change nothing; a filled exercise line
// replaces that exercise's sets for the day, so a short handoff can fix or fill in a past day's sets).
async function restoreText(text) {
  const t = text.trim();
  if (t.startsWith('{')) { await db.importAll(JSON.parse(t)); await syncAll().catch(() => {}); toast('Backup restored'); setTimeout(() => location.reload(), 600); return; }
  // Several days in one paste: each DATE: line starts the next day.
  const parts = t.split(/\n(?=\s*DATE:)/).map(x => x.trim()).filter(Boolean);
  const dates = [];
  for (const part of parts) { const parsed = parseHandoff(part); await importDay(parsed); dates.push(parsed.day.date); }
  syncDates(dates).catch(() => {});
  (await import('./shell.js')).clearPastCounts();
  toast(dates.length === 1 ? 'Day updated' : `${dates.length} days updated`, null, dates.join(', '));
}
function restoreSheet() {
  const ta = h('textarea', { rows: 8, placeholder: 'Paste a backup, or one or more days (each starts with DATE: ...)', 'aria-label': 'Backup or handoff text' });
  const s = sheet('Restore', h('div', { class: 'stack' },
    h('label', { class: 'btn ghost file' }, 'Choose a backup file',
      h('input', { type: 'file', accept: 'application/json,.json,text/plain', onchange: async e => {
        try { await restoreText(await e.target.files[0].text()); s.close(); } catch (err) { toast(err.message); }
      } })),
    ta,
    h('button', { class: 'btn', onclick: async () => { try { await restoreText(ta.value); s.close(); } catch (err) { toast(err.message); } } }, 'Restore pasted text'),
    h('p', { class: 'muted small' }, 'A backup puts back every record it holds. A handoff updates that one day; an exercise line in it replaces that exercise’s sets.')), { full: true });
}

// Reading speed for Listen. The voice itself is set in Android (Text-to-speech, preferred engine and its voice):
// browsers on Android list one entry per language and speak with the engine's voice, so an in-app voice list
// cannot change it. Try it speaks a line at the chosen speed.
async function voiceSheet() {
  if (!('speechSynthesis' in window)) return toast('This phone cannot read aloud.');
  let { rate } = await voiceSettings();
  const body = h('div', { class: 'stack' });
  const sample = 'Run in such a way that you may obtain it. First Corinthians nine, twenty-four.';
  const tryIt = async () => { speechSynthesis.cancel(); speechSynthesis.speak(await utterance(sample)); };
  const draw = () => fill(body,
    h('div', { class: 'seg' }, RATES.map(r => h('button', { class: r === rate ? 'on' : '', onclick: async () => { rate = r; await setRate(r); draw(); tryIt(); } }, `${r}x`))),
    h('p', { class: 'muted small' }, 'The voice is the phone’s: Settings, General management, Text-to-speech. Pick the preferred engine, then its voice. After a change, force stop Brave once.'));
  draw();
  sheet('Reading speed', body, { onClose: () => speechSynthesis.cancel() });
}

// Voice stop: teach it your "stop", then test it. Train records about 20 of your "stop"s (one every second and a half,
// as prompted), 10 seconds of your room with no one talking, and 10 seconds of normal talking, then learns your
// "stop" on the phone in a few seconds. Test listens and shows how sure it is, with the dial's mark. Nothing is
// sent anywhere; the recordings stay on the phone so more can be added later, and Start over removes them.
async function voiceStopSheet() {
  const V = await import('../listen.js');
  if (!V.voiceSupported()) return toast('This phone cannot use voice stop.');
  let t = await V.getThreshold(), busy = false, closed = false, lastHit = 0;
  const body = h('div', { class: 'stack vstop' });
  const prompt = h('p', { class: 'vm-said' }, 'Getting the speech model ready');
  const fillEl = h('span', { class: 'vm-fill' }), mark = h('span', { class: 'vm-mark' });
  const value = h('b', {}, '');
  const place = () => { mark.style.left = `${t * 100}%`; value.textContent = `${Math.round(t * 100)}%`; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const run = async job => { if (busy) return; busy = true; V.quiet(); try { await job(); } catch { prompt.textContent = 'That did not work. Check the microphone is allowed for Telmyn.'; } busy = false; if (!closed) { await draw(); test(); } };

  const recordStops = () => run(async () => {
    for (let k = 1; k <= 20 && !closed; k++) {
      prompt.textContent = `Say “stop”  (${k} of 20)`; prompt.classList.add('now');
      await V.recordStop(); prompt.classList.remove('now'); await wait(500);
    }
    prompt.textContent = 'Stops recorded';
  });
  const recordRoom = () => run(async () => {
    prompt.textContent = 'Room sound: stay quiet for 10 seconds'; await V.recordRoom('_background_noise_', 10);
    if (closed) return;
    prompt.textContent = 'Now talk normally for 10 seconds (no “stop”)'; await V.recordRoom('talk', 10);
    prompt.textContent = 'Room recorded';
  });
  const teach = () => run(async () => { await V.train(p => { prompt.textContent = `Learning your “stop”: ${Math.round(p * 100)}%`; }); prompt.textContent = 'Trained. Test it below.'; });
  const restart = () => run(async () => { await V.forget(); prompt.textContent = 'Cleared. Using the general model.'; });

  // Test: listen and show the meter until something else starts.
  const test = async () => {
    if (closed || busy) return;
    prompt.textContent = 'Listening. Say “stop” once.';
    try {
      await V.listen(null, (sc, heard) => {
        fillEl.style.transform = `scaleX(${sc})`;
        if (heard && Date.now() - lastHit > 1200) { lastHit = Date.now(); prompt.textContent = `Heard it (${Math.round(sc * 100)}% sure)`; prompt.classList.add('ok'); setTimeout(() => { if (!busy) { prompt.textContent = 'Listening. Say “stop” once.'; prompt.classList.remove('ok'); } }, 1200); }
      });
    } catch { prompt.textContent = 'The microphone is not allowed for Telmyn.'; }
  };

  const draw = async () => {
    const n = await V.counts();
    const stops = n.stop || 0, room = (n._background_noise_ || 0) > 0 && (n.talk || 0) > 0;
    const slider = h('input', { type: 'range', min: 50, max: 95, step: 5, value: Math.round(t * 100), 'aria-label': 'How sure it must be',
      oninput: e => { t = Number(e.target.value) / 100; place(); }, onchange: () => V.setThreshold(t) });
    fill(body,
      h('p', { class: 'muted small' }, V.isTrained() ? `Trained on your voice (${stops} stops and your room).` : 'Using the general model. Train it on your voice for a steadier stop.'),
      h('div', { class: 'vt-steps' },
        h('button', { class: `btn ghost${stops >= 20 ? ' done' : ''}`, onclick: recordStops }, stops ? `Stops: ${stops}. Add 20` : '1. Record 20 stops'),
        h('button', { class: `btn ghost${room ? ' done' : ''}`, onclick: recordRoom }, room ? 'Room recorded. Again' : '2. Record your room (20 sec)'),
        h('button', { class: 'btn', disabled: stops < 8 || !room, onclick: teach }, '3. Train')),
      prompt,
      h('div', { class: 'vm' }, fillEl, mark),
      h('div', { class: 'vm-dial' }, h('span', { class: 'muted small' }, 'Softer stop'), slider, h('span', { class: 'muted small' }, 'Clearer stop')),
      h('p', { class: 'center small' }, 'Acts at ', value, ' sure. Say “stop” once; it counts when the bar holds past the mark for a moment.'),
      stops || V.isTrained() ? h('button', { class: 'btn ghost small', onclick: restart }, 'Start over') : null);
    place();
  };
  sheet('Voice stop', body, { full: true, onClose: () => { closed = true; V.quiet(); } });
  try { await V.ready(); await draw(); test(); } catch { prompt.textContent = 'The speech model did not load.'; fill(body, prompt); }
}

export async function dataActions() {
  const persisted = await navigator.storage?.persisted?.();
  const on = await remindersOn();
  const last = await db.getMeta('last_export');
  const days = last ? Math.floor((Date.now() - new Date(last)) / 86400000) : null;
  const cloud = !TEST && !!(await syncKey());
  const sent = cloud ? await syncLast() : null;
  const when = t => (isoDate(new Date(t)) === isoDate() ? hhmm(new Date(t)) : isoDate(new Date(t)));
  // One status line: the backup file's age (warning color after 7 days) and the cloud copy's last send.
  const status = `${last === null ? 'No backup file yet.' : `Backed up ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}.`}${cloud ? ` Cloud copy ${sent ? when(sent) : 'waiting'}.` : ''}`;
  return h('div', { class: 'stack' },
    h('div', { class: 'bar' },
      h('button', { class: 'btn ghost', onclick: backUp }, 'Back up'),
      h('button', { class: 'btn ghost', onclick: restoreSheet }, 'Restore')),
    h('div', { class: 'bar' },
      h('button', { class: 'btn ghost', onclick: voiceSheet }, 'Reading speed'),
      h('button', { class: 'btn ghost', onclick: voiceStopSheet }, 'Voice stop')),
    h('div', { class: 'bar' },
      h('button', { class: `btn ghost reminders${on ? ' on' : ''}`, onclick: async () => { const v = await setReminders(!on); if (v !== !on && !on) return; location.reload(); } }, on ? 'Reminders on' : 'Reminders off'),
      TEST ? h('button', { class: 'btn ghost', onclick: testSheet }, 'Test controls')
        : h('button', { class: `btn ghost reminders${cloud ? ' on' : ''}`, onclick: async () => {
          if (!cloud) { toast('Cloud copy starts from the setup link made on the PC.'); return; }
          try { const n = await syncAll(); toast(`Sent ${n} day${n === 1 ? '' : 's'} to the cloud copy`); } catch (err) { toast(err.message); }
        } }, cloud ? 'Cloud copy on' : 'Cloud copy off')),
    h('p', { class: `muted small${last === null || days >= 7 ? ' warn' : ''}` }, status),
    h('p', { class: 'fine center' }, `Version ${APP_VERSION}${TEST ? ', test app' : ''}. ${persisted ? 'Storage protected.' : 'Add to Home Screen to protect storage.'}`),
    TEST ? h('p', { class: 'fine center' }, `Screen ${document.documentElement.dataset.screen || ''}`) : null);
}

// Test app controls (only in the separate test app). Fake clock via the URL: ?date=YYYY-MM-DD&time=HH:MM&speed=N
// Real data can come in only one way: you copy it in the real app and paste it here. Nothing ever goes back.
export function testSheet() {
  if (!TEST) return;
  const d = now();
  const date = h('input', { type: 'date', value: isoDate(d), 'aria-label': 'Test date' });
  const time = h('input', { type: 'time', value: hhmm(d), 'aria-label': 'Test time' });
  let speed = SPEED;
  const speeds = h('div', { class: 'seg' });
  const drawSpeeds = () => fill(speeds, [1, 10, 60].map(n => h('button', { class: speed === n ? 'on' : '', onclick: () => { speed = n; drawSpeeds(); } }, `${n}x`)));
  drawSpeeds();
  const paste = h('textarea', { rows: 3, placeholder: 'Paste a full record copied from the real app', 'aria-label': 'Full record' });
  const body = h('div', { class: 'stack' },
    h('p', { class: 'muted small' }, 'Separate app, separate storage. Nothing here can reach your real data.'),
    h('div', { class: 'row' }, date, time),
    speeds,
    h('button', { class: 'btn', onclick: () => { location.href = `${location.pathname}?date=${date.value}&time=${time.value}&speed=${speed}#today`; } }, 'Restart clock'),
    paste,
    h('div', { class: 'bar' },
      h('button', { class: 'btn ghost', onclick: async () => {
        try { await db.importAll(JSON.parse(paste.value), { replace: true }); toast('Copy loaded'); setTimeout(() => location.reload(), 600); }
        catch (err) { toast(err.message.startsWith('That') ? err.message : 'That is not a full record.'); }
      } }, 'Load pasted copy'),
      h('button', { class: 'btn ghost', onclick: async () => { await db.clearAll(); toast('Test data cleared'); setTimeout(() => location.reload(), 600); } }, 'Clear test data')));
  sheet('Test controls', body);
}
