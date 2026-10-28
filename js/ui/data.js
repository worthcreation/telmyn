import { h, sheet, toast } from './dom.js';
import * as db from '../db.js';
import { state, importDay } from '../state.js';
import { parseHandoff, buildHandoff } from '../handoff.js';
import { APP_VERSION } from '../version.js';
import { TEST, isoDate } from '../clock.js';

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
  return h('div', { class: 'stack' },
    h('button', { class: 'btn ghost', onclick: async () => {
      await navigator.clipboard.writeText(buildHandoff(state));
      toast('Handoff copied');
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
    h('label', { class: 'btn ghost file' }, 'Restore backup',
      h('input', { type: 'file', accept: 'application/json,.json', onchange: async e => {
        try { await db.importAll(JSON.parse(await e.target.files[0].text())); toast('Backup restored'); location.reload(); }
        catch (err) { toast(err.message); }
      } })),
    h('p', { class: 'muted small' }, persisted ? 'Storage is protected from automatic clearing.' : 'Add to Home Screen to protect storage from being cleared.'),
    h('p', { class: 'muted small' }, `Version ${APP_VERSION}${TEST ? ', test mode (separate data)' : ''}`),
    h('p', { class: 'muted small' }, 'Alarms for scheduled blocks arrive in phase 2.'));
}

export async function dataSheet() { sheet('Data', await dataActions()); }

function pasteSheet() {
  const ta = h('textarea', { rows: 10, placeholder: 'Paste a handoff starting with DATE:', 'aria-label': 'Handoff text' });
  const s = sheet('Import a handoff', h('div', { class: 'stack' }, ta,
    h('button', { class: 'btn', onclick: async () => {
      try {
        const parsed = parseHandoff(ta.value);
        await importDay(parsed);
        toast(`Imported ${parsed.day.date}`);
        s.close();
      } catch (err) { toast(err.message); }
    } }, 'Import'),
    h('p', { class: 'muted small' }, 'Fills blanks only. Anything already logged in the app is kept.')), { full: true });
}
