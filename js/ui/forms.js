import { h, sheet, toast } from './dom.js';
import { state, setField, addFluid, undoFluid, addProtein } from '../state.js';
import { DAY_FIELDS, FLUID_KINDS, ozFromMl, cleanNumber } from '../schema.js';

export function fluidSheet() {
  let kind = 'water';
  const body = h('div', { class: 'stack' });
  const draw = () => body.replaceChildren(
    h('div', { class: 'seg wrap' }, FLUID_KINDS.map(k => h('button', { class: kind === k.key ? 'on' : '', onclick: () => { kind = k.key; draw(); } }, k.label))),
    h('div', { class: 'grid4' }, [8, 16.9, 24, 25].map(oz => h('button', { class: 'chip', onclick: () => add(oz) }, `${oz} oz`))),
    h('div', { class: 'row' },
      h('input', { id: 'f-amt', type: 'number', inputmode: 'decimal', placeholder: 'Amount', 'aria-label': 'Amount' }),
      h('button', { class: 'chip', onclick: () => custom('oz') }, 'oz'),
      h('button', { class: 'chip', onclick: () => custom('ml') }, 'ml')),
    state.fluids.length ? h('button', { class: 'btn ghost', onclick: async () => { await undoFluid(); draw(); } }, 'Undo last entry') : null);
  const add = async (oz, ml = null) => { await addFluid(kind, oz, ml); toast(`Logged ${oz} oz ${FLUID_KINDS.find(k => k.key === kind).label.toLowerCase()}`); s.close(); };
  const custom = unit => {
    const n = cleanNumber(document.getElementById('f-amt').value);
    if (n === null) return toast('Enter an amount first');
    unit === 'ml' ? add(ozFromMl(n), n) : add(n);
  };
  draw();
  const s = sheet('Add fluid', body);
}

export function proteinSheet() {
  const body = h('div', { class: 'stack' },
    h('div', { class: 'grid4' }, [20, 30, 40, 50].map(g => h('button', { class: 'chip', onclick: () => add(g) }, `${g} g`))),
    h('div', { class: 'row' },
      h('input', { id: 'p-amt', type: 'number', inputmode: 'numeric', placeholder: 'Grams', 'aria-label': 'Grams' }),
      h('button', { class: 'chip', onclick: () => { const n = cleanNumber(document.getElementById('p-amt').value); n === null ? toast('Enter grams first') : add(n); } }, 'Add')),
    h('p', { class: 'muted small' }, 'Adds to today’s total. Edit the total in Log.'));
  const add = async g => { await addProtein(g); toast(`Protein now ${state.day.protein_g} g`); s.close(); };
  const s = sheet('Add protein', body);
}

export function logSheet() {
  const groups = [...new Set(DAY_FIELDS.map(f => f.group))];
  const field = f => {
    const val = state.day[f.key];
    const id = `fld-${f.key}`;
    const save = raw => setField(f.key, f.type === 'number' ? cleanNumber(raw) : (raw === '' ? null : raw));
    let input;
    if (f.derivedFrom && state.fluids.length) {
      return h('div', { class: 'field' }, h('span', { class: 'lbl' }, `${f.label} (${f.unit})`), h('span', { class: 'derived' }, 'From fluid entries'));
    }
    if (f.type === 'choice') {
      input = h('div', { class: 'seg' }, f.options.map(o => h('button', { class: val === o ? 'on' : '', onclick: async () => { await save(state.day[f.key] === o ? '' : o); draw(); } }, o)));
    } else if (f.type === 'textarea') {
      input = h('textarea', { id, rows: 2, onchange: e => save(e.target.value) }, val ?? '');
    } else {
      input = h('input', { id, type: f.type === 'number' ? 'number' : f.type, inputmode: f.type === 'number' ? 'decimal' : null, step: f.step || null, value: val ?? '', onchange: e => save(e.target.value) });
    }
    return h('div', { class: 'field' }, h('label', { class: 'lbl', for: id }, f.unit ? `${f.label} (${f.unit})` : f.label), input);
  };
  // One group at a time, picked by tabs, so the form never needs to scroll.
  let current = groups[0];
  const body = h('div', { class: 'log-form' });
  const draw = () => body.replaceChildren(
    h('div', { class: 'seg wrap tabs' }, groups.map(g => h('button', { class: g === current ? 'on' : '', onclick: () => { current = g; draw(); } }, g))),
    h('div', { class: 'fields' }, DAY_FIELDS.filter(f => f.group === current).map(field)),
    h('p', { class: 'muted small' }, 'Saves as you go. Empty means not recorded.'));
  draw();
  sheet('Today’s log', body, { full: true });
}
