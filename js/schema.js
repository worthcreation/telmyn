// Every daily field lives here once. The log form, handoff import and handoff export all read this list.
// Rules: units in the key (_lb, _g, _oz, _min, _sec). Blank = null (not recorded). 0 = recorded as zero.
// Rename a key only through a migration plus an INSTRUCTION UPDATES note.

export const DAY_FIELDS = [
  { key: 'day_status', label: 'Day', type: 'choice', options: ['day in progress', 'day complete'], group: 'Day' },
  { key: 'bed_time', label: 'Bed', type: 'time', group: 'Body' },
  { key: 'wake_time', label: 'Wake', type: 'time', group: 'Body' },
  { key: 'weight_lb', label: 'Weight', unit: 'lb', type: 'number', step: 0.1, group: 'Body' },
  { key: 'toe_touch_notes', label: 'Toe touch reach', type: 'text', group: 'Body' },
  { key: 'protein_g', label: 'Protein', unit: 'g', type: 'number', group: 'Fuel' },
  { key: 'eating_notes', label: 'Eating', type: 'textarea', group: 'Fuel' },
  { key: 'water_oz', label: 'Water', unit: 'oz', type: 'number', step: 0.1, group: 'Fuel', derivedFrom: 'fluids' },
  { key: 'other_drinks_oz', label: 'Other drinks', unit: 'oz', type: 'number', step: 0.1, group: 'Fuel', derivedFrom: 'fluids' },
  { key: 'drinks_notes', label: 'Drink notes', type: 'textarea', group: 'Fuel' },
  { key: 'pinch_level', label: 'Pinch', type: 'choice', options: ['none', 'squeeze', 'sharp'], group: 'Watch' },
  { key: 'pinch_notes', label: 'Pinch notes', type: 'text', group: 'Watch' },
  { key: 'ankles_feet_notes', label: 'Ankles and feet', type: 'textarea', group: 'Watch' },
  { key: 'verse_applied_notes', label: 'Verse applied', type: 'textarea', group: 'Notes' },
  { key: 'energy_notes', label: 'Energy', type: 'textarea', group: 'Notes' },
  { key: 'flags_notes', label: 'Flags for tomorrow', type: 'textarea', group: 'Notes' },
  { key: 'tomorrow_notes', label: 'Tomorrow', type: 'textarea', group: 'Notes' },
];

// Fields carried only by imported handoffs (status lines the app normally derives from events).
export const IMPORT_ONLY = ['stretch_status', 'fab_five_status', 'routine_status', 'row_min', 'hourly_blocks_count', 'gripper', 'hourly_palm_notes', 'verse_ref', 'instruction_updates', 'handoff_raw', 'program_version', 'week', 'day'];

export const FLUID_KINDS = [
  { key: 'water', label: 'Water', bucket: 'water_oz' },
  { key: 'huel_water', label: 'Huel water', bucket: 'water_oz' },
  { key: 'yerba_mate', label: 'Yerba mate', bucket: 'other_drinks_oz' },
  { key: 'coffee', label: 'Coffee', bucket: 'other_drinks_oz' },
  { key: 'other', label: 'Other', bucket: 'other_drinks_oz' },
];

export const ML_PER_OZ = 29.5735;
export const ozFromMl = ml => Math.round((ml / ML_PER_OZ) * 10) / 10;

export const blankDay = date => Object.fromEntries([['date', date], ...DAY_FIELDS.map(f => [f.key, null])]);

// Numbers in, numbers out. Anything that is not a clean number stays null (blank), never a guess.
export function cleanNumber(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

// Totals = number carried in from an imported handoff (if any) + fluid entries logged in the app.
// Blank stays blank when there is neither.
export function fluidTotals(day, fluids) {
  const t = { water_oz: day.water_oz ?? null, other_drinks_oz: day.other_drinks_oz ?? null };
  for (const f of fluids) {
    const k = FLUID_KINDS.find(k => k.key === f.kind)?.bucket || 'other_drinks_oz';
    t[k] = Math.round(((t[k] || 0) + f.oz) * 10) / 10;
  }
  return t;
}
