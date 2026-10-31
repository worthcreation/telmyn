// On-device storage. Nothing here ever leaves the phone except through Export.
// To change the shape of stored data: bump DB_VERSION and add MIGRATIONS[n]. Never edit an old migration.

export const DB_VERSION = 2;
export const STORES = ['days', 'events', 'sets', 'fluids', 'xp', 'meta'];

const MIGRATIONS = {
  1(db) {
    db.createObjectStore('days', { keyPath: 'date' });          // one row per day: scalar fields from schema.js
    for (const s of ['events', 'sets', 'fluids', 'xp']) {        // many rows per day, each with a date
      const os = db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
      os.createIndex('date', 'date');
    }
    db.createObjectStore('meta', { keyPath: 'key' });           // settings and app state
  },
  // 0.24.0: on weekends ankle pumps became calf raises (Ross, 2026-10-31). Sets logged with the Pumps button on a
  // Saturday or Sunday before then were calf raises, so they move to calf_raises with their times unchanged.
  2(db, tx) {
    const weekend = iso => { const [y, m, d] = iso.split('-').map(Number); const w = new Date(y, m - 1, d).getDay(); return w === 0 || w === 6; };
    tx.objectStore('events').openCursor().onsuccess = e => {
      const c = e.target.result;
      if (!c) return;
      const v = c.value;
      if (v.type === 'habit' && v.habit === 'ankle_pumps' && v.date && weekend(v.date)) c.update({ ...v, habit: 'calf_raises' });
      c.continue();
    };
  },
};

let db;

export function open(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = e => {
      for (let v = e.oldVersion + 1; v <= DB_VERSION; v++) MIGRATIONS[v](req.result, req.transaction);
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    let out;
    const req = fn(t.objectStore(store));
    if (req) req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => resolve(out);
    t.onerror = t.onabort = () => reject(t.error);
  });
}

export const get = (s, k) => tx(s, 'readonly', o => o.get(k));
export const put = (s, v) => tx(s, 'readwrite', o => o.put(v));
export const del = (s, k) => tx(s, 'readwrite', o => o.delete(k));
export const all = s => tx(s, 'readonly', o => o.getAll());
export const byDate = (s, date) => tx(s, 'readonly', o => o.index('date').getAll(date));

export async function deleteWhere(s, date, pred) {
  for (const row of await byDate(s, date)) if (pred(row)) await del(s, row.id);
}

export async function getMeta(key, fallback = null) {
  const row = await get('meta', key);
  return row ? row.value : fallback;
}
export const setMeta = (key, value) => put('meta', { key, value });

export const CACHE_KEY = /^(verse|videos|daily):/;

export async function exportAll(appVersion) {
  const out = { format: 'telmyn-export', db_version: DB_VERSION, app_version: appVersion, exported_at: new Date().toISOString(), stores: {} };
  for (const s of STORES) out.stores[s] = await all(s);
  // Cached verse text and video lists are re-fetchable, so they stay out of backups.
  out.stores.meta = out.stores.meta.filter(m => !CACHE_KEY.test(m.key));
  return out;
}

export async function importAll(data, { replace = false } = {}) {
  if (data?.format !== 'telmyn-export') throw new Error('That file is not a Telmyn export.');
  if (data.db_version > DB_VERSION) throw new Error('That export is from a newer version. Update the app first.');
  if (replace) for (const s of STORES) await tx(s, 'readwrite', o => o.clear());
  for (const s of STORES) for (const row of data.stores[s] || []) await put(s, row);
}

export async function clearAll() { for (const s of STORES) await tx(s, 'readwrite', o => o.clear()); }
