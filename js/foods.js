// One-tap foods. Each preset knows everything it adds: protein, the fluid it is mixed with, and the eating note.
// Numbers come from Ross's label or his stated recipe. Add a preset here and it gets a button on Today.
export const FOODS = [
  {
    key: 'huel', label: 'Huel',
    protein_g: 40,
    fluid: { kind: 'huel_water', oz: 16.9, ml: 500 },
    note: 'Huel Black Edition, 1 serving (40 g protein, 400 kcal per label), 500 ml water',
  },
];

export const foodByKey = key => FOODS.find(f => f.key === key) || null;

// The eating-notes line a food adds, stamped with the time it was logged.
export const foodLine = (food, time) => `${time}: ${food.note}.`;

// Append or remove one line in the eating notes. Blank stays blank (null), never an empty string.
export function addLine(notes, line) { return notes ? `${notes} ${line}` : line; }
export function removeLine(notes, line) {
  if (!notes) return null;
  const i = notes.lastIndexOf(line);
  if (i < 0) return notes;
  const out = (notes.slice(0, i) + notes.slice(i + line.length)).replace(/\s{2,}/g, ' ').trim();
  return out || null;
}
