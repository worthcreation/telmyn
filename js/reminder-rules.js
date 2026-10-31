// Reminder rules, in one place: the Worker's push reminders (worker/src/push.js bundles this file), the in-app
// checks (remind.js), the pulsing pills (status.js) and which leg habit a day has (program/index.js) all read it.
// No imports, so the Worker and the app can both load it.
// Rules (Ross's choices): grip break hourly and ankle pumps every 30 min on weekdays 08:00-17:00; on weekends ankle
// pumps become calf raises, hourly, same hours (2026-10-31). Weight from 06:00 until logged. A reminder that goes
// unanswered (nothing logged for it since) comes again every 15 min (2026-10-31); weight's follow-ups run
// 07:00-12:00 so they never ring before the usual wake time.

export const RULES = {
  grip: { title: 'Grip break', days: 'weekdays', from: '08:00', to: '17:00', every: 60 },
  pumps: { title: 'Ankle pumps', days: 'weekdays', from: '08:00', to: '17:00', every: 30 },
  calf: { title: 'Calf raises', days: 'weekends', from: '08:00', to: '17:00', every: 60 },
  weight: { title: 'Weight', days: 'all', from: '06:00', followFrom: '07:00', followTo: '12:00' },
};
export const FOLLOW_UP_MIN = 15;
export const TIMED = ['grip', 'pumps', 'calf'];

// day: 0 Sunday to 6 Saturday.
export const onDay = (days, day) => days === 'all' || (days === 'weekdays' ? day >= 1 && day <= 5 : day === 0 || day === 6);

// Local clock for a time zone, from its offset (minutes, as Date.getTimezoneOffset gives them).
export function local(now, offsetMin) {
  const d = new Date(now - offsetMin * 60000), date = d.toISOString().slice(0, 10);
  return { day: d.getUTCDay(), hm: d.toISOString().slice(11, 16), date, at: hm => Date.parse(`${date}T${hm}:00Z`) + offsetMin * 60000 };
}

const ago = min => (min >= 60 && min % 60 === 0 ? (min === 60 ? 'an hour' : `${min / 60} hours`) : `${min} minutes`);

// What is due right now. rec: { offset, state: { grip, pumps, calf (ms of the last one), weight (date logged),
// say: { pumps, calf } (the amounts, e.g. "30 per foot") }, sent: { kind: ms of the last reminder } }.
// A kind is due once its interval has passed since the last one logged (or since the window opened); after that
// it repeats every FOLLOW_UP_MIN until something is logged for it.
export function due(rec, now = Date.now()) {
  const out = [];
  const L = local(now, rec.offset || 0);
  const s = rec.state || {}, sent = rec.sent || {}, say = s.say || {};
  const follow = FOLLOW_UP_MIN * 60000;
  for (const kind of TIMED) {
    const r = RULES[kind];
    if (!onDay(r.days, L.day) || L.hm < r.from || L.hm >= r.to) continue;
    const opened = L.at(r.from), base = Math.max(s[kind] || 0, opened);
    if (now - base < r.every * 60000) continue;
    const last = typeof sent[kind] === 'number' ? sent[kind] : 0;
    const again = last > base;
    if (again && now - last < follow) continue;
    const text = kind === 'grip'
      ? (s.grip && s.grip > opened ? 'It has been an hour since the last one.' : 'First grip break of the day.')
      : `${say[kind] || 'Time for a set'}. It has been over ${ago(r.every)}.`;
    out.push({ kind, title: r.title, body: again ? `Still due. ${text}` : text });
  }
  const w = RULES.weight;
  if (L.hm >= w.from && s.weight !== L.date) {
    // Older records kept the date of the reminder instead of its time.
    const last = typeof sent.weight === 'number' ? sent.weight : sent.weight === L.date ? L.at(w.from) : 0;
    const today = last >= L.at('00:00');
    if (!today) out.push({ kind: 'weight', title: w.title, body: 'Nothing logged today. Tap Weight on Today.' });
    else if (L.hm >= w.followFrom && L.hm < w.followTo && now - last >= follow) out.push({ kind: 'weight', title: w.title, body: 'Still not logged today. Tap Weight on Today.' });
  }
  return out;
}

// Minutes past due for a timed kind at a local time (null when not due or outside its days and hours). For the
// pulsing pills: lastAt is the last one logged (ms or null).
export function minutesOver(kind, lastAt, now) {
  const r = RULES[kind], L = local(now, new Date(now).getTimezoneOffset());
  if (!onDay(r.days, L.day) || L.hm < r.from || L.hm >= r.to) return null;
  const over = (now - Math.max(lastAt || 0, L.at(r.from))) / 60000 - r.every;
  return over > 0 ? over : null;
}
