import { h, sheet, toast, fill } from './dom.js';
import * as db from '../db.js';
import { state, importDay, setField } from '../state.js';
import { parseHandoff, buildHandoff } from '../handoff.js';
import { APP_VERSION } from '../version.js';
import { remindersOn, setReminders } from '../remind.js';
import { TEST, SPEED, isoDate, hhmm, now } from '../clock.js';
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

async function copyBackup(text) {
  await navigator.clipboard.writeText(text ?? await backupText());
  toast('Full record copied. Paste it into the chat.');
}

export async function dataActions() {
  const persisted = await navigator.storage?.persisted?.();
  // How old the last backup is; after 7 days it gets the warning color.
  const on = await remindersOn();
  const last = await db.getMeta('last_export');
  const days = last ? Math.floor((Date.now() - new Date(last)) / 86400000) : null;
  const cloud = !TEST && !!(await syncKey());
  const sent = cloud ? await syncLast() : null;
  const when = t => (isoDate(new Date(t)) === isoDate() ? hhmm(new Date(t)) : isoDate(new Date(t)));
  const cloudLine = !cloud ? '' : sent ? ` Cloud copy sent ${when(sent)}.` : ' Cloud copy waiting to send.';
  const backupLine = (last === null ? (cloud ? 'No backup file yet.' : 'No backup yet. Export one to keep a copy off the phone.')
    : `Last backup ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}.`) + cloudLine;
  return h('div', { class: 'stack' },
    h('button', { class: 'btn ghost', onclick: async () => {
      await navigator.clipboard.writeText(buildHandoff(state));
      // Copying the handoff is usually the end of the day: offer to close it out.
      if (state.day.day_status === 'day complete') toast('Handoff copied');
      else toast('Handoff copied', { label: 'Mark day complete', fn: async () => { await setField('day_status', 'day complete'); toast('Day marked complete'); } });
    } }, 'Copy today’s handoff'),
    h('button', { class: 'btn ghost', onclick: () => pasteSheet() }, 'Import a handoff'),
    h('div', { class: 'bar' },
      h('button', { class: 'btn ghost', onclick: async () => {
        let text;
        try {
          text = await backupText();
          const how = await shareOrDownload(`telmyn-export-${isoDate()}.json`, text);
          if (how === 'downloaded') toast('Backup saved to Downloads');
        } catch (err) {
          try { await copyBackup(text); } catch { toast(`Export failed: ${err?.message || err}`); }
        }
      } }, 'Export backup'),
      h('button', { class: 'btn ghost', onclick: async () => {
        try { await copyBackup(); } catch (err) { toast(`Copy failed: ${err?.message || err}`); }
      } }, 'Copy full record')),
    h('div', { class: TEST ? 'bar' : '' },
      h('label', { class: 'btn ghost file' }, 'Restore backup',
        h('input', { type: 'file', accept: 'application/json,.json,text/plain', onchange: async e => {
          try { await db.importAll(JSON.parse(await e.target.files[0].text())); toast('Backup restored'); location.reload(); }
          catch (err) { toast(err.message); }
        } })),
      TEST ? h('button', { class: 'btn ghost', onclick: testSheet }, 'Test controls') : null),
    h('div', { class: TEST ? '' : 'bar' },
      h('button', { class: `btn ghost reminders${on ? ' on' : ''}`, onclick: async () => { const v = await setReminders(!on); if (v !== !on && !on) return; location.reload(); } }, on ? 'Reminders on' : 'Reminders off'),
      TEST ? null : h('button', { class: `btn ghost reminders${cloud ? ' on' : ''}`, onclick: async () => {
        if (!cloud) { toast('Cloud copy starts from the setup link made on the PC.'); return; }
        try { const n = await syncAll(); toast(`Sent ${n} day${n === 1 ? '' : 's'} to the cloud copy`); } catch (err) { toast(err.message); }
      } }, cloud ? 'Cloud copy on' : 'Cloud copy off')),
    h('p', { class: 'muted small' }, 'Grip hourly, pumps every 30 min, weight daily. Only when overdue.'),
    h('p', { class: `muted small${last === null || days >= 7 ? ' warn' : ''}` }, backupLine),
    h('p', { class: 'fine center' }, `Version ${APP_VERSION}${TEST ? ', test app' : ''}. ${persisted ? 'Storage protected.' : 'Add to Home Screen to protect storage.'}`),
    TEST ? h('p', { class: 'fine center' }, `Screen ${document.documentElement.dataset.screen || ''}`) : null,
    null);
}

export async function dataSheet() { sheet('Data', await dataActions()); }

function pasteSheet() {
  const ta = h('textarea', { rows: 10, placeholder: 'Paste a handoff starting with DATE:', 'aria-label': 'Handoff text' });
  const s = sheet('Import a handoff', h('div', { class: 'stack' }, ta,
    h('button', { class: 'btn', onclick: async () => {
      try {
        const parsed = parseHandoff(ta.value);
        await importDay(parsed);
        syncDates([parsed.day.date]).catch(() => {});
        toast(`Imported ${parsed.day.date}`);
        s.close();
      } catch (err) { toast(err.message); }
    } }, 'Import'),
    h('p', { class: 'muted small' }, 'Updates that day with every value the handoff carries; blank lines change nothing. Blocks, sets and drinks logged in the app are kept.')), { full: true });
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
