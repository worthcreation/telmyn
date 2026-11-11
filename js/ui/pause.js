// The pause sheet (from Me, or the pause line on Today): pick a preset, the dates, what stays on, and a reason.
// One pause at a time on any date; the sheet edits the one covering today, else the next one coming, else a new one.
import { h, fill, sheet, toast } from './dom.js';
import { state, load } from '../state.js';
import { addDays, dayLabel } from '../clock.js';
import { PAUSE_ITEMS, PRESETS, currentPause, savePause, endPause, presetChoice, pauseName } from '../pause.js';
import { syncDates } from '../sync.js';

export async function pauseSheet(after = () => {}) {
  const today = state.date;
  const cur = currentPause(today);
  const p = cur ? { ...cur, off: [...cur.off] } : { preset: 'light', from: today, to: addDays(today, 2), reason: '', off: [...await presetChoice('light')] };
  const body = h('div', { class: 'stack pause-form' });
  let s;

  // Days whose plan changed and have already started go to the cloud copy again; Today redraws.
  const touched = (...ranges) => {
    const out = new Set();
    for (const [a, b] of ranges) for (let d = a; d && d <= b && d <= today; d = addDays(d, 1)) out.add(d);
    return [...out];
  };
  const done = async (dates, msg, detail) => {
    await load(today);
    syncDates(dates).catch(() => {});
    (await import('./shell.js')).clearPastCounts();
    s.close(); after(); toast(msg, null, detail);
  };
  const save = async () => {
    const err = await savePause(p);
    if (err) return toast(err);
    await done(touched([p.from, p.to], cur ? [cur.from, cur.to] : [null, null]), cur ? 'Pause changed' : 'Pause set', `${pauseName(p)}, ${dayLabel(p.from)} to ${dayLabel(p.to)}`);
  };
  const end = async () => {
    await endPause(cur.id, today, addDays(today, -1));
    await done(touched([cur.from, cur.to]), cur.from > today ? 'Pause cancelled' : 'Pause ended', 'Everything is back on today.');
  };

  const draw = () => fill(body,
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Kind of pause' }, Object.entries(PRESETS).map(([k, v]) =>
      h('button', { class: p.preset === k ? 'on' : '', onclick: async () => { p.preset = k; p.off = [...await presetChoice(k)]; draw(); } }, v.label))),
    h('div', { class: 'pause-dates' },
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'From'), h('input', { type: 'date', value: p.from, onchange: e => { p.from = e.target.value; } })),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Through'), h('input', { type: 'date', value: p.to, onchange: e => { p.to = e.target.value; } }))),
    h('p', { class: 'lbl' }, 'Stays on'),
    h('ul', { class: 'pause-items' }, PAUSE_ITEMS.map(it => h('li', {},
      h('label', {}, h('input', { type: 'checkbox', checked: !p.off.includes(it.key), onchange: e => { p.off = e.target.checked ? p.off.filter(k => k !== it.key) : [...p.off, it.key]; } }),
        h('span', {}, it.label))))),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Reason'),
      h('input', { type: 'text', value: p.reason || '', placeholder: 'Optional, such as tattoo healing', onchange: e => { p.reason = e.target.value.trim(); } })),
    h('div', { class: 'pause-acts' },
      cur ? h('button', { class: 'btn ghost', onclick: end }, cur.from > today ? 'Cancel pause' : 'End now') : null,
      h('button', { class: 'btn', onclick: save }, cur ? 'Save' : 'Start pause')));
  draw();
  s = sheet(cur ? 'Pause' : 'New pause', body, { full: true });
}
