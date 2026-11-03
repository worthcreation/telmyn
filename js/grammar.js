// Grammar in plain words, for the word page: the STEPBible parsing ("verb, present, middle, indicative, 3rd person,
// singular") becomes a few short lines a reader can use ("Present: happening now, or ongoing"). Only the parts that
// change the meaning get a line; gender and number are folded into one "Who" or "Form" line. Pure; tested.

const PLAIN = {
  // Greek tense
  present: ['Present', 'happening now, or ongoing'],
  aorist: ['Aorist', 'a single, whole action, usually past'],
  imperfect: ['Imperfect', 'ongoing or repeated in the past'],
  perfect: ['Perfect', 'done, with a result that lasts'],
  future: ['Future', 'will happen'],
  // Greek voice
  active: ['Active', 'the subject does it'],
  middle: ['Middle', 'the subject does it for or to itself'],
  passive: ['Passive', 'it is done to the subject'],
  'middle or passive': ['Middle or passive', 'the subject does it for itself, or has it done to it (same form)'],
  // Mood
  indicative: ['Statement', 'says what is so'],
  imperative: ['Command', 'tells someone to do it'],
  subjunctive: ['Possible', 'what may or should happen (purpose, condition)'],
  infinitive: ['Infinitive', '"to ..." form'],
  participle: ['Participle', 'an "-ing" form, acting like a describing word or a noun'],
  jussive: ['Wish or mild command', '"let it be so"'],
  'perfect with vav': ['Perfect with "and"', 'continues a story or plan, often future'],
  'infinitive construct': ['Infinitive', '"to ..." form'],
  'infinitive absolute': ['Infinitive absolute', 'stresses the action ("surely ...")'],
  'active participle': ['Participle', 'an "-ing" form, the one doing it'],
  // Case
  nominative: ['Subject', 'the one doing or being (or describing it)'],
  genitive: ['Of', '"of", belonging to, or from'],
  dative: ['To or for', '"to", "for", "with" or "by"'],
  accusative: ['Object', 'what receives the action'],
  vocative: ['Called to', 'someone addressed directly'],
  // Hebrew stems
  Qal: ['Qal', 'the plain, simple action'],
  Niphal: ['Niphal', 'passive or reflexive: done to, or to oneself'],
  Piel: ['Piel', 'intensive: done fully or repeatedly'],
  Pual: ['Pual', 'passive of the intensive'],
  Hiphil: ['Hiphil', 'causes it: makes someone do or be it'],
  Hophal: ['Hophal', 'passive of causing'],
  Hithpael: ['Hithpael', 'reflexive: does it to or for oneself'],
  construct: ['Construct', 'joined to the next word: "X of Y"'],
  absolute: null,
};
const PERSON = { '1st person': ['I', 'we'], '2nd person': ['you', 'you all'], '3rd person': ['he, she or it', 'they'] };
const KIND = /^(verb|noun|adjective|adverb|article|preposition|conjunction|particle|negative particle|proper noun|pronoun|\w+ pronoun|cond)$/;

// gram: the STEPBible string. Returns { kind, lines: [[label, plain], ...] }.
export function plainGrammar(gram) {
  const parts = (gram || '').split(',').map(x => x.trim()).filter(Boolean);
  const kind = parts.find(p => KIND.test(p)) || '';
  const lines = [];
  for (const p of parts) if (PLAIN[p]) lines.push(PLAIN[p]);
  const person = parts.find(p => PERSON[p]), plural = parts.includes('plural');
  if (person) lines.push(['Who', PERSON[person][plural ? 1 : 0]]);
  else if (!/verb|particle|preposition|conjunction|adverb|cond/.test(kind) || parts.includes('participle')) {
    const g = parts.find(p => /^(masculine|feminine|neuter|common)$/.test(p));
    const n = parts.find(p => /^(singular|plural)$/.test(p));
    if (g || n) lines.push(['Form', [n, g].filter(Boolean).join(', ')]);
  }
  return { kind: kind === 'cond' ? 'conditional particle' : kind, lines };
}

// STEPBible book abbreviations (Psa.1.1) to the names the verse service takes (Psalm 1:1).
const BOOKS = {
  Gen: 'Genesis', Exo: 'Exodus', Lev: 'Leviticus', Num: 'Numbers', Deu: 'Deuteronomy', Jos: 'Joshua', Jdg: 'Judges',
  Rut: 'Ruth', '1Sa': '1 Samuel', '2Sa': '2 Samuel', '1Ki': '1 Kings', '2Ki': '2 Kings', '1Ch': '1 Chronicles',
  '2Ch': '2 Chronicles', Ezr: 'Ezra', Neh: 'Nehemiah', Est: 'Esther', Job: 'Job', Psa: 'Psalm', Pro: 'Proverbs',
  Ecc: 'Ecclesiastes', Sng: 'Song of Songs', Isa: 'Isaiah', Jer: 'Jeremiah', Lam: 'Lamentations', Ezk: 'Ezekiel',
  Dan: 'Daniel', Hos: 'Hosea', Jol: 'Joel', Amo: 'Amos', Oba: 'Obadiah', Jon: 'Jonah', Mic: 'Micah', Nam: 'Nahum',
  Hab: 'Habakkuk', Zep: 'Zephaniah', Hag: 'Haggai', Zec: 'Zechariah', Mal: 'Malachi', Mat: 'Matthew', Mrk: 'Mark',
  Luk: 'Luke', Jhn: 'John', Act: 'Acts', Rom: 'Romans', '1Co': '1 Corinthians', '2Co': '2 Corinthians',
  Gal: 'Galatians', Eph: 'Ephesians', Php: 'Philippians', Col: 'Colossians', '1Th': '1 Thessalonians',
  '2Th': '2 Thessalonians', '1Ti': '1 Timothy', '2Ti': '2 Timothy', Tit: 'Titus', Phm: 'Philemon', Heb: 'Hebrews',
  Jas: 'James', '1Pe': '1 Peter', '2Pe': '2 Peter', '1Jn': '1 John', '2Jn': '2 John', '3Jn': '3 John', Jud: 'Jude',
  Rev: 'Revelation',
};
export const readableRef = r => { const [b, c, v] = r.split('.'); return `${BOOKS[b] || b} ${c}:${v}`; };
// Does a STEPBible ref fall inside a passage like "James 1:12" or "Philippians 2:5-8"?
export function inPassage(r, passage) {
  const m = passage.match(/^(.+?)\s(\d+):(\d+)(?:-(\d+))?$/);
  const [b, c, v] = readableRef(r).match(/^(.+?)\s(\d+):(\d+)$/).slice(1);
  return !!m && b === (m[1] === 'Psalms' ? 'Psalm' : m[1]) && Number(c) === Number(m[2]) && Number(v) >= Number(m[3]) && Number(v) <= Number(m[4] || m[3]);
}
