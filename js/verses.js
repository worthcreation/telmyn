// Daily verse: theme by weekday, rotating one verse per week per theme (NKJV).
// Verse text comes live from Bible Gateway through the Telmyn API (scripture.js) in the version Ross picks,
// and is cached on the phone. Nothing is typed from memory. TEXT below stays empty unless a checked text is added.
import { weekday } from './clock.js';
import { weekAndDay } from './program/index.js';

export const COPYRIGHT = 'Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission.';

export const THEMES = ['Jesus as example', 'Set God first', 'Perseverance', 'Wisdom', 'Challenge yourself', 'Kindness', 'Love']; // Sun..Sat

export const BANK = [
  ['John 13:15', '1 Peter 2:21', 'Philippians 2:5-8', 'Hebrews 12:2', 'Mark 1:35'],
  ['Matthew 6:33', 'Proverbs 3:5-6', 'Colossians 3:23', 'Deuteronomy 6:5', '1 Timothy 4:8'],
  ['Galatians 6:9', 'James 1:12', 'Hebrews 12:1', 'Romans 5:3-4', 'Isaiah 40:31'],
  ['James 1:5', 'Proverbs 1:7', 'Proverbs 4:7', 'Proverbs 9:10', 'Proverbs 27:17'],
  ['1 Corinthians 9:24-27', 'Philippians 3:13-14', '2 Timothy 4:7', 'Philippians 4:13', 'Joshua 1:9'],
  ['Ephesians 4:32', 'Colossians 3:12', 'Proverbs 11:17', 'Micah 6:8', 'Galatians 5:22-23'],
  ['1 Corinthians 13:4-7', 'John 13:34-35', '1 John 4:19', 'Romans 13:10', 'Mark 12:30-31'],
];

// Verified NKJV text keyed by reference. Empty until checked.
export const TEXT = {};

export function verseFor(iso) {
  const wd = weekday(iso);
  const { week } = weekAndDay(iso);
  const list = BANK[wd];
  const ref = list[(Math.max(week, 1) - 1) % list.length];
  return { ref, theme: THEMES[wd], text: TEXT[ref] || null, links: links(ref) };
}

function parts(ref) {
  const m = ref.match(/^(.+?)\s(\d+):(\d+)/);
  return { book: m[1], chapter: m[2], verse: m[3] };
}

export function links(ref) {
  const { book, chapter, verse } = parts(ref);
  const q = encodeURIComponent(ref);
  const slug = book.toLowerCase().replace(/\s+/g, '_');
  return {
    read: `https://www.biblegateway.com/passage/?search=${q}&version=NKJV`,
    interlinear: `https://biblehub.com/interlinear/${slug}/${chapter}-${verse}.htm`,
    blb: `https://www.blueletterbible.org/search/preSearch.cfm?Criteria=${q}&t=NKJV`,
  };
}
