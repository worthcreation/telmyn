// Voice stop, on the phone itself: while a timer runs in a block, saying "stop" does what the main button would (a
// hang stops and saves, a hold or a rest ends). A small speech model (Google's open speech-commands model, 18 words,
// "stop" among them) runs here with TensorFlow.js; the mic's sound is scored in memory a few times a second and never
// stored or sent anywhere. The engine and the model are Telmyn's own files (js/vendor, data/models), cached for
// offline use, and load only the first time voice stop is used. No chime: nothing restarts.
const ENGINE = ['js/vendor/tf.min.js', 'js/vendor/speech-commands.min.js'];
const MODEL = 'data/models/speech-commands/model.json', META = 'data/models/speech-commands/metadata.json';
// How sure the model must be that it heard "stop" before it acts. Set on the Voice stop dial in Me (saved):
// lower hears a softer "stop", higher needs a clearer one and fires less on other sounds.
import * as db from './db.js';
export const DEFAULT_THRESHOLD = 0.85;
let threshold = DEFAULT_THRESHOLD;
export const getThreshold = async () => { if (!recognizer) threshold = (await db.getMeta('voice_threshold', DEFAULT_THRESHOLD)) ?? DEFAULT_THRESHOLD; return threshold; };
export async function setThreshold(v) { threshold = v; await db.setMeta('voice_threshold', v); }

export const voiceSupported = () => !!(navigator.mediaDevices?.getUserMedia && (globalThis.AudioContext || globalThis.webkitAudioContext));

let recognizer = null, loading = null, stopIndex = -1, onHit = null, fired = false, wanted = false;
let denied = null;
export const onDenied = fn => { denied = fn; };

const script = src => new Promise((ok, fail) => {
  if (document.querySelector(`script[data-engine="${src}"]`)) return ok();
  const s = document.createElement('script'); s.src = src; s.dataset.engine = src; s.onload = ok; s.onerror = () => fail(new Error(`Could not load ${src}`));
  document.head.append(s);
});

// Load the engine and the model once (first use); later calls reuse them.
export function ready() {
  if (recognizer) return Promise.resolve(recognizer);
  loading ??= (async () => {
    threshold = (await db.getMeta('voice_threshold', DEFAULT_THRESHOLD)) ?? DEFAULT_THRESHOLD;
    for (const src of ENGINE) await script(src);
    const r = globalThis.speechCommands.create('BROWSER_FFT', undefined, new URL(MODEL, location.href).href, new URL(META, location.href).href);
    await r.ensureModelLoaded();
    stopIndex = r.wordLabels().indexOf('stop');
    recognizer = r;
    return r;
  })().catch(e => { loading = null; throw e; });
  return loading;
}

// When it counts as "stop": the model's best guess for the sound must be "stop" (not background noise or another
// word), above the dial's mark, on two readings in a row (about a quarter second apart). A single spike, which is
// what quiet room noise produces, never counts. hit: called once when "stop" is heard. score (optional): called with
// every reading, (how sure it is of "stop" from 0 to 1, whether this reading completed a "stop"), for the dial's meter.
let onScore = null, streak = 0;
export function judge(scores, index, mark) {
  const s = scores[index];
  const top = scores.every((x, k) => k === index || x < s);
  streak = top && s >= mark ? streak + 1 : 0;
  return streak >= 2;
}
export async function listen(hit, score = null) {
  onHit = hit; onScore = score; fired = false; wanted = true; streak = 0;
  const r = await ready();
  if (!wanted || r.isListening()) return;
  try {
    await r.listen(async result => {
      if (stopIndex < 0) return;
      const s = result.scores[stopIndex];
      const heard = judge(result.scores, stopIndex, threshold);
      onScore?.(s, heard);
      if (heard) streak = 0;
      if (fired || !onHit || !heard) return;
      fired = true; const f = onHit; f();
    }, { probabilityThreshold: 0, overlapFactor: 0.75, includeSpectrogram: false, invokeCallbackOnNoiseAndUnknown: true });
    if (!wanted) quiet();   // the timer ended while the mic was opening
  } catch (e) {
    wanted = false;
    if (/denied|NotAllowed|Permission/i.test(`${e?.name} ${e?.message}`)) denied?.();
    else throw e;
  }
}

export function quiet() {
  wanted = false; onHit = null; onScore = null;
  try { if (recognizer?.isListening()) recognizer.stopListening(); } catch { /* already stopped */ }
}
