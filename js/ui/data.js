import { h, sheet, toast, fill } from './dom.js';
import * as db from '../db.js';
import { importDay } from '../state.js';
import { parseHandoff } from '../handoff.js';
import { APP_VERSION } from '../version.js';
import { remindersOn, setReminders } from '../remind.js';
import { TEST, SPEED, isoDate, hhmm, now } from '../clock.js';
import { voices, voiceSettings, setVoice, setRate, utterance, RATES } from '../voice.js';
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
// A backup merges every record; a handoff updates that one day (blank lines change nothing).
async function restoreText(text) {
  const t = text.trim();
  if (t.startsWith('{')) { await db.importAll(JSON.parse(t)); await syncAll().catch(() => {}); toast('Backup restored'); setTimeout(() => location.reload(), 600); return; }
  const parsed = parseHandoff(t);
  await importDay(parsed);
  syncDates([parsed.day.date]).catch(() => {});
  toast(`Updated ${parsed.day.date}`);
}
function restoreSheet() {
  const ta = h('textarea', { rows: 8, placeholder: 'Paste a backup or a handoff (DATE: ...)', 'aria-label': 'Backup or handoff text' });
  const s = sheet('Restore', h('div', { class: 'stack' },
    h('label', { class: 'btn ghost file' }, 'Choose a backup file',
      h('input', { type: 'file', accept: 'application/json,.json,text/plain', onchange: async e => {
        try { await restoreText(await e.target.files[0].text()); s.close(); } catch (err) { toast(err.message); }
      } })),
    ta,
    h('button', { class: 'btn', onclick: async () => { try { await restoreText(ta.value); s.close(); } catch (err) { toast(err.message); } } }, 'Restore pasted text'),
    h('p', { class: 'muted small' }, 'Nothing is deleted. A backup puts back every record it holds; a handoff updates that one day.')), { full: true });
}

// Reading voice for Listen: pick from the phone's English voices and a speed; Try it speaks a line.
async function voiceSheet() {
  if (!('speechSynthesis' in window)) return toast('This phone cannot read aloud.');
  const list = await voices();
  let { uri, rate } = await voiceSettings();
  const body = h('div', { class: 'entries-wrap' });
  const sample = 'Run in such a way that you may obtain it. First Corinthians nine, twenty-four.';
  const tryIt = async () => { speechSynthesis.cancel(); speechSynthesis.speak(await utterance(sample)); };
  const draw = () => fill(body,
    h('div', { class: 'seg' }, RATES.map(r => h('button', { class: r === rate ? 'on' : '', onclick: async () => { rate = r; await setRate(r); draw(); tryIt(); } }, `${r}x`))),
    h('div', { class: 'entries', role: 'list' },
      [{ voiceURI: null, name: 'Phone default', lang: '' }, ...list].map(v => h('button', { class: `ent voice${v.voiceURI === uri ? ' on' : ''}`, role: 'listitem', onclick: async () => { uri = v.voiceURI; await setVoice(uri); draw(); tryIt(); } },
        h('span', { class: 'ent-at' }, v.voiceURI === uri ? '✓' : ''), h('span', { class: 'ent-what' }, v.name), h('span', { class: 'ent-amt' }, v.lang), h('span')))),
    h('p', { class: 'muted small' }, 'Voices come from the phone. More can be added in Android settings, Text-to-speech.'));
  draw();
  sheet('Reading voice', body, { full: true, onClose: () => speechSynthesis.cancel() });
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
    h('button', { class: 'btn ghost', onclick: voiceSheet }, 'Reading voice'),
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
