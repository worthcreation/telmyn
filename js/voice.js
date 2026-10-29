// Reading speed for Listen, kept on the phone. The voice is the phone's text-to-speech engine's (Android settings);
// browsers on Android cannot pick among its voices, so there is no voice choice here.
import * as db from './db.js';

export const RATES = [0.8, 0.9, 1, 1.1, 1.25];
export async function voiceSettings() { return { rate: await db.getMeta('tts_rate', 0.95) }; }
export const setRate = r => db.setMeta('tts_rate', r);

export async function utterance(text) {
  const { rate } = await voiceSettings();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  return u;
}
