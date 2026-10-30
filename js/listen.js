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

// recognizer: what listens. Your trained "stop" once you have trained it (Me, Voice stop), else the general model.
let recognizer = null, base = null, trainer = null, loading = null, stopIndex = -1, onHit = null, fired = false, wanted = false;
export const TRAINED_NAME = 'telmyn-stop';
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
    base = globalThis.speechCommands.create('BROWSER_FFT', undefined, new URL(MODEL, location.href).href, new URL(META, location.href).href);
    await base.ensureModelLoaded();
    // One add-on per name (the library allows no second), made here once: loaded if trained before, else empty.
    trainer = base.createTransfer(TRAINED_NAME);
    let r = base;
    try { await trainer.load(); r = trainer; } catch { /* not trained yet: the general model */ }
    const saved = await db.getMeta('voice_examples', null);
    if (saved) try { trainer.loadExamples(saved, false); } catch { /* unreadable: start fresh */ }   // false: nothing to clear yet (clearing an empty set throws)
    use(r);
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
function use(r) { recognizer = r; stopIndex = r.wordLabels().indexOf('stop'); }
export const isTrained = () => recognizer && recognizer !== base;

// ---------- Training on your voice (Me, Voice stop) ----------
// Examples: your "stop" (about 1 second each), your room with no one talking (_background_noise_), and normal
// talking ("talk"). They stay on the phone (kept so more can be added later); the trained add-on is saved in the
// phone's storage. Nothing is sent anywhere.
async function getTrainer() { await ready(); return trainer; }
const keep = async t => db.setMeta('voice_examples', t.serializeExamples());
export async function counts() {
  const t = await getTrainer();
  try { return t.countExamples(); } catch { return {}; }
}
export async function recordStop() { quiet(); const t = await getTrainer(); await t.collectExample('stop'); await keep(t); }
export async function recordRoom(label, sec) { quiet(); const t = await getTrainer(); await t.collectExample(label, { durationSec: sec }); await keep(t); }
export async function train(progress) {
  quiet();
  const t = await getTrainer();
  const epochs = 20;
  await t.train({ epochs, windowHopRatio: 0.25, augmentByMixingNoiseRatio: 0.5,
    callback: { onEpochEnd: async epoch => progress?.((epoch + 1) / epochs) } });
  await t.save();
  use(t);
}
export async function forget() {
  quiet();
  await db.setMeta('voice_examples', null);
  try { await globalThis.tf?.io.removeModel(`indexeddb://tfjs-speech-commands-model/${TRAINED_NAME}`); } catch { /* none saved */ }
  try { trainer?.clearExamples(); } catch { /* already empty (clearing an empty set throws) */ }
  if (base) use(base);
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
