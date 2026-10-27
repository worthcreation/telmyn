// Hourly block history: blocks imported from a chat handoff (palms parsed from the notes) plus blocks logged in the app.
// Shared by Today and the runner so both suggest the same next palms.

export function hourlyHistory(day, events) {
  const out = [];
  const notes = day?.hourly_palm_notes || '';
  for (const m of notes.matchAll(/block\s*(\d+)\s*palms?\s*(up|down|not noted)/gi)) {
    out.push({ n: Number(m[1]), palms: /not/i.test(m[2]) ? null : m[2].toLowerCase(), at: null, source: 'import' });
  }
  const imported = Math.max(day?.hourly_blocks_count || 0, out.length);
  while (out.length < imported) out.push({ n: out.length + 1, palms: null, at: null, source: 'import' });
  events.filter(e => e.type === 'block_done' && e.block === 'hourly')
    .forEach((e, k) => out.push({ n: imported + k + 1, palms: e.palms || null, at: e.at, source: 'app' }));
  return out;
}

export function nextPalms(history) {
  const last = [...history].reverse().find(h => h.palms);
  return last ? (last.palms === 'up' ? 'down' : 'up') : null;
}
