// Voice stop: while a timer runs in a block, saying "stop" (or "done") does what the main button would: stops and saves
// a hang, ends a hold early, or ends a rest. Uses the phone's own speech recognition (Chrome sends the audio to
// Google to recognize, so it needs a connection). Partial results are used, so the word counts as soon as it is heard,
// not after you finish speaking. Android ends listening after a pause, so it restarts until the timer ends.
const Rec = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const voiceSupported = () => !!Rec;
const WORDS = /\b(stop|done)\b/i;

let rec = null, active = false, onHit = null, fired = false;

export function listen(hit) {
  if (!Rec) return;
  onHit = hit; fired = false;
  if (active) return;
  active = true;
  start();
}

export function quiet() {
  active = false; onHit = null;
  try { rec?.abort(); } catch { /* already stopped */ }
  rec = null;
}

function start() {
  if (!active) return;
  rec = new Rec();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  rec.onresult = e => {
    for (let k = e.resultIndex; k < e.results.length; k++)
      for (const alt of e.results[k]) if (WORDS.test(alt.transcript) && !fired && onHit) { fired = true; const f = onHit; f(); return; }
  };
  rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { active = false; denied?.(); } };
  rec.onend = () => { if (active) setTimeout(start, 150); };
  try { rec.start(); } catch { /* starting twice: the running one carries on */ }
}

let denied = null;
export const onDenied = fn => { denied = fn; };
