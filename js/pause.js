// Pauses (Ross, 2026-11-11): a date range where chosen blocks and habits are off, such as a light week while a
// tattoo heals. A paused block leaves the day's plan (program/index.js planFor), a paused habit leaves Today and its
// reminders go quiet (reminder-rules.js due, from the range the phone reports), and Progress counts a paused day
// as paused, never as missed. Stored on the phone in meta 'pauses'; each preset remembers its last choices in
// meta 'pause_presets'. One pause covers any one date.
import * as db from './db.js';

// What a pause can switch off. Blocks by their id in the day's plan ('routine' is the day's strength, row or walk,
// whichever the day has);
// habits by the reminder they quiet ('legs' is ankle pumps on weekdays and calf raises on weekends).
export const PAUSE_ITEMS = [
  { key: 'stretch', label: 'Morning stretch' },
  { key: 'gates', label: 'Fab Five' },
  { key: 'routine', label: 'Routine' },
  { key: 'hangs', label: 'Dead hangs' },
  { key: 'evening_legs', label: 'Legs up' },
  { key: 'grip', label: 'Grip breaks' },
  { key: 'legs', label: 'Pumps, calf raises' },
  { key: 'creatine', label: 'Creatine' },
  { key: 'weight', label: 'Weight' },
];
// Starting choices for each preset (what goes off). Light is Ross's tattoo week: stretch, Fab Five, hangs and
// legs up stay (2026-11-11).
export const PRESETS = {
  light: { label: 'Light', off: ['routine', 'grip', 'legs'] },
  sick: { label: 'Sick', off: ['stretch', 'gates', 'routine', 'hangs', 'grip', 'legs'] },
  travel: { label: 'Travel', off: ['gates', 'routine', 'hangs', 'grip'] },
};
// Which reminder kinds each item quiets.
export const PAUSE_KINDS = { grip: ['grip'], legs: ['pumps', 'calf'], creatine: ['creatine'], weight: ['weight'] };

let list = [];
export async function loadPauses() { list = (await db.getMeta('pauses', [])) || []; }
export const setPauses = l => { list = l; };   // tests and the test app
export const allPauses = () => list;

// The pause covering a date, or null.
export const pauseFor = iso => list.find(p => iso >= p.from && iso <= p.to) || null;
export const pausedOn = (iso, key) => !!pauseFor(iso)?.off.includes(key);
// The words for a pause: "Light: tattoo healing".
export const pauseName = p => [PRESETS[p.preset]?.label || 'Paused', p.reason].filter(Boolean).join(': ');

// The pause to show for a date: the one covering it, else the next one coming.
export function currentPause(iso) {
  return pauseFor(iso) || [...list].filter(p => p.from > iso).sort((a, b) => a.from.localeCompare(b.from))[0] || null;
}
// For the Worker: every pause not yet over, as { from, to, kinds } (the reminder kinds it quiets).
export const pauseState = iso => list.filter(p => p.to >= iso).map(p => ({ from: p.from, to: p.to, kinds: p.off.flatMap(k => PAUSE_KINDS[k] || []) }));

export const presetChoice = async key => ((await db.getMeta('pause_presets', {})) || {})[key] || PRESETS[key].off;

// Save a pause (new, or the same id changed). Returns an error message when it overlaps another one.
export async function savePause(p) {
  if (!p.from || !p.to || p.to < p.from) return 'The end date comes before the start.';
  const clash = list.find(x => x.id !== p.id && x.from <= p.to && x.to >= p.from);
  if (clash) return `That overlaps the pause from ${clash.from} to ${clash.to}.`;
  const rec = { ...p, id: p.id || `p${Date.now()}` };
  list = [...list.filter(x => x.id !== rec.id), rec].sort((a, b) => a.from.localeCompare(b.from));
  await db.setMeta('pauses', list);
  await db.setMeta('pause_presets', { ...((await db.getMeta('pause_presets', {})) || {}), [rec.preset]: rec.off });
  return null;
}
// End a pause now: today is back to normal. One that already ran keeps its past days; one not started is removed.
export async function endPause(id, today, yesterday) {
  const p = list.find(x => x.id === id);
  if (!p) return;
  list = p.from < today ? list.map(x => (x.id === id ? { ...x, to: yesterday } : x)) : list.filter(x => x.id !== id);
  await db.setMeta('pauses', list);
}
