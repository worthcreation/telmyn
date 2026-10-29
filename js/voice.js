// Reading voice for Listen: the phone's own text-to-speech voices. The choice and speed are kept on the phone.
// Nothing is sent anywhere; the phone speaks the text itself.
import * as db from './db.js';

export const RATES = [0.8, 0.9, 1, 1.1, 1.25];

// Voices load after the page starts on some phones; wait briefly for them.
export function voices() {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) return resolve([]);
    const got = () => speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    if (got().length) return resolve(got());
    speechSynthesis.addEventListener('voiceschanged', () => resolve(got()), { once: true });
    setTimeout(() => resolve(got()), 1500);
  });
}

export async function voiceSettings() {
  return { uri: await db.getMeta('tts_voice', null), rate: await db.getMeta('tts_rate', 0.95) };
}
export const setVoice = uri => db.setMeta('tts_voice', uri);
export const setRate = r => db.setMeta('tts_rate', r);

// An utterance with the chosen voice and speed (the phone's default voice when none is chosen or it is gone).
export async function utterance(text) {
  const { uri, rate } = await voiceSettings();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  const v = uri ? (await voices()).find(x => x.voiceURI === uri) : null;
  if (v) { u.voice = v; u.lang = v.lang; }
  return u;
}
