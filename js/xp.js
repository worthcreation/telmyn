// XP is computed FROM the log, never stored as the truth. The xp store only caches results.
// That means the curve can be recalibrated after 3-4 weeks and every past day re-scored fairly.
// Physical skills level only from real accomplishments. Discipline earns bonuses, not physical levels.

export const SKILLS = {
  strength: { label: 'Strength', kind: 'physical' },
  endurance: { label: 'Endurance', kind: 'physical' },
  grip: { label: 'Grip', kind: 'physical' },
  mobility: { label: 'Mobility', kind: 'physical' },
  fuel: { label: 'Fuel', kind: 'physical' },
  recovery: { label: 'Recovery', kind: 'physical' },
  spirit: { label: 'Spirit', kind: 'physical' },
  discipline: { label: 'Discipline', kind: 'bonus' },
};

// Deferred: scoring rules and curve. Placeholder returns no XP so nothing fake is ever shown.
export function scoreDay(/* { day, sets, events, fluids, history } */) {
  return [];
}
