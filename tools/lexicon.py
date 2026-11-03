# Builds data/words/<id>.json, one small file per word for the word page (fetched only when opened), and corrects the Hebrew behind each Greek key word in data/original.json.
#   python3 tools/lexicon.py            (clones the two sources into .lexsrc/ the first time; about 150 MB, not committed)
# Sources, both credited in README:
#   STEPBible.org data (Tyndale House Cambridge), CC BY 4.0: TBESH and TBESG lexicons (senses; Abbott-Smith for Greek),
#     TAHOT and TAGNT tagged Bibles (how often a word appears, and where).
#   Strong's dictionaries (1894, public domain text; Open Scriptures JSON, CC BY-SA): Strong's definition, KJV
#     renderings, and "from" links, which give each word's root and family.
# The Hebrew behind a Greek word is what Abbott-Smith lists "in LXX for", matched to TBESH by its vowels, not only its
# letters. (Matching letters alone took the wrong word for several: makarios got the verb ashar "to bless" instead of
# osher "happiness"; thanatos got davar "to speak"; morphe got taar "to border".)
import collections, glob, json, os, re, subprocess, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '.lexsrc')
SB, OS = os.path.join(SRC, 'stepbible'), os.path.join(SRC, 'strongs')
REFS_MAX = 60          # verses listed per word (all of them up to 60; spread across the Bible when there are more)
FAMILY_MAX = 8


def fetch():
    os.makedirs(SRC, exist_ok=True)
    if not os.path.isdir(OS):
        subprocess.run(['git', 'clone', '-q', '--depth', '1', 'https://github.com/openscriptures/strongs.git', OS], check=True)
    if not os.path.isdir(SB):
        subprocess.run(['git', 'clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout', 'https://github.com/STEPBible/STEPBible-Data.git', SB], check=True)
        names = subprocess.run(['git', '-C', SB, 'ls-tree', '-r', '--name-only', 'HEAD'], capture_output=True, text=True, check=True).stdout.splitlines()
        want = [n for n in names if re.match(r'Lexicons/TBES[GH] ', n) or re.match(r'Translators Amalgamated OT\+NT/TA(GNT|HOT) ', n)]
        subprocess.run(['git', '-C', SB, 'checkout', '-q', 'HEAD', '--'] + want, check=True)


def rows(path, header):
    out, on = [], False
    for line in open(path, encoding='utf8'):
        if line.startswith(header): on = True; continue
        if on and re.match(r'^[GH]\d{4}', line): out.append(line.rstrip('\n').split('\t'))
    return out


ACC = re.compile('[\u0591-\u05AF\u05BD\u05BC\u05C0\u05C3\u05C4\u05C5\u200d]')
def norm(w): return ACC.sub('', unicodedata.normalize('NFC', w))          # no accents, meteg or dagesh
def cons(w): return re.sub('[^\u05D0-\u05EA]', '', w)                     # letters only
VERSE = re.compile(r'^(?:[1-3][A-Z][a-z]|[A-Z][a-z]{2})\.\d')     # a verse line (Gen.1.1, 1Co.7.40), not a note
# The tagged files in Bible order (their names sort differently).
ORDER = ['Gen-Deu', 'Jos-Est', 'Job-Sng', 'Isa-Mal', 'Mat-Jhn', 'Act-Rev']
def in_order(paths): return sorted(paths, key=lambda p: next(k for k, o in enumerate(ORDER) if o in os.path.basename(p)))
def base(s): return re.sub(r'[A-Z]$', '', s)                              # H0376G -> H0376 (keeps a, b: own words)
def num(s): return s[:5]                                                  # H7218a, H7218G -> H7218: counts and verses
STOP = set('the and for with from that this which who what not one any are was were has have had into upon unto its his her'.split())
def tokens(t): return {w for w in re.findall(r'[a-z]{3,}', re.sub(r'<[^>]+>', ' ', t.lower())) if w not in STOP}
def strongs_key(s): m = re.match(r'([GH])0*(\d+)', s); return f'{m.group(1)}{m.group(2)}'
def translit(t): return re.sub(r'[.\u02bc\u02be\u02bf]', '', t).replace("'", '').strip().lower()


def clean(html):
    t = re.sub(r"<ref='[^']*'>([^<]*)</ref>", r'\1', html)
    t = re.sub(r'(?i)<br\s*/?>', '\n', t)
    t = re.sub(r'<[^>]+>', '', t)
    t = re.sub(r'\(AS\)\s*$', '', t)
    t = re.sub(r'[ \t]+', ' ', t)
    return '\n'.join(x.strip() for x in t.split('\n') if x.strip())


def hebrew_senses(meaning):
    out = []
    for part in re.split(r'(?i)<br\s*/?>', meaning):
        p = clean(part)
        if not p or p.startswith(('Also means', 'Another spelling', 'A man of', 'A woman of')): continue
        m = re.match(r'^(?:[A-Z]:\s*)?(\d+[a-z]?\d*[a-z]?)\)\s*(.*)$', p)
        if m:
            label, text = m.groups()
            depth = len(re.findall(r'\d+|[a-z]', label)) - 1
            if text: out.append([min(depth, 3), text])
        elif not out:
            out.append([0, p])
    return out


def greek_senses(text):
    # Abbott-Smith's bold English glosses, in order, are its senses.
    out = []
    for b in re.findall(r'<b>([^<]+)</b>', text):
        b = b.strip(' ,;:.')
        if b and not re.search('[\u0370-\u03FF\u1F00-\u1FFF]', b) and b not in [x[1] for x in out]: out.append([0, b])
    return out


def main():
    fetch()
    H = rows(glob.glob(os.path.join(SB, 'Lexicons', 'TBESH*'))[0], 'eStrong#\tdStrong')
    G = rows(glob.glob(os.path.join(SB, 'Lexicons', 'TBESG*'))[0], 'eStrong\tdStrong')
    load = lambda p: json.loads((lambda s: s[s.index('{'):s.rindex('}') + 1])(open(p, encoding='utf8').read()))
    SH = load(os.path.join(OS, 'hebrew', 'strongs-hebrew-dictionary.js'))
    SG = load(os.path.join(OS, 'greek', 'strongs-greek-dictionary.js'))

    # Where every word appears (English verse numbers; Hebrew numbering is in parentheses in TAHOT).
    where = collections.defaultdict(list)
    tagged = os.path.join(SB, 'Translators Amalgamated OT+NT')
    for p in in_order(glob.glob(os.path.join(tagged, 'TAHOT *'))):
        for line in open(p, encoding='utf8'):
            if not VERSE.match(line): continue
            c = line.split('\t')
            ref = c[0].split('#')[0].split('(')[0]
            for s in re.findall(r'\{(H\d{4})', c[4] if len(c) > 4 else ''):
                if not where[s] or where[s][-1] != ref: where[s].append(ref)
    for p in in_order(glob.glob(os.path.join(tagged, 'TAGNT *'))):
        for line in open(p, encoding='utf8'):
            if not VERSE.match(line): continue
            c = line.split('\t')
            ref, kind = c[0].split('#')[0], c[0].split('=')[-1]
            if 'K' not in kind or len(c) < 4: continue          # the Textus Receptus words (the NKJV's base)
            s = num(c[3].split('=')[0])
            if not where[s] or where[s][-1] != ref: where[s].append(ref)

    HB, GB = {}, {}
    for r in H: HB.setdefault(base(r[0]), r)        # the first row of a number is its main sense
    for r in G: GB.setdefault(base(r[0]), r)
    by_vowels, by_letters = collections.defaultdict(list), collections.defaultdict(list)
    for r in H:
        by_vowels[norm(r[3])].append(base(r[0])); by_letters[cons(r[3])].append(base(r[0]))
    count = lambda s: len(where.get(num(s), []))

    def hebrew_for(x, sense):
        if cons(x) == 'יהוה': return 'H3068'
        if len(cons(x)) < 2: return None
        ids = list(dict.fromkeys(by_vowels.get(norm(x), [])))
        if not ids:
            ids = list(dict.fromkeys(by_letters.get(cons(x), [])))
            if norm(x) == cons(x):                               # written without vowels: Abbott-Smith's verb roots
                verbs = [i for i in ids if HB[i][5].startswith('H:V')]
                ids = verbs or ids
        # Same spelling, different words (anah "to answer" and anah "to humble"; massah "testing" and Massah the
        # place): the one whose meaning shares the most words with the Greek's, then the one that is not a name, then
        # the most common.
        return max(ids, key=lambda i: (len(sense & tokens(HB[i][6] + ' ' + HB[i][7])), '-Pr' not in HB[i][5], count(i))) if ids else None

    # Abbott-Smith gives no LXX line for the name Jesus; the Septuagint's Iesous is Joshua (Yehoshua), later Yeshua.
    NAMES = {'G2424': ['H3442', 'H3091']}
    def lxx(gs):
        if base(gs) in NAMES: return NAMES[base(gs)]
        r = GB.get(base(gs))
        m = r and re.search(r'\[in LXX[^\]]*\]', r[7])
        if not m: return []
        found = re.findall('[\u05D0-\u05EA][\u0590-\u05FF]*', m.group(0))
        sense = tokens(r[6] + ' ' + ' '.join(b for b in re.findall(r'<b>([^<]+)</b>', r[7])))
        return list(dict.fromkeys(i for i in (hebrew_for(x, sense) for x in found) if i))[:3]

    # Root and family from Strong's "from" links.
    def parents(s):
        d = (SH if s[0] == 'H' else SG).get(strongs_key(s), {})
        return [f'{p[0]}{int(p[1:]):04d}' for p in re.findall(r'\b([GH]\d+)', d.get('derivation', ''))]
    kids = collections.defaultdict(list)
    for d, pre in ((SH, 'H'), (SG, 'G')):
        for k in d:
            for p in parents(f'{pre}{int(k[1:]):04d}')[:1]: kids[p].append(f'{pre}{int(k[1:]):04d}')

    def family(s):
        ps = parents(s)
        root = ps[0] if ps else s
        fam = [root] + kids.get(root, []) + kids.get(s, [])
        fam = [f for f in dict.fromkeys(fam) if f != s and (HB if f[0] == 'H' else GB).get(f)]
        return sorted(fam, key=lambda f: (f != root, -count(f)))[:FAMILY_MAX], (root if ps else None)

    def spread(refs):
        if len(refs) <= REFS_MAX: return refs
        step = len(refs) / REFS_MAX
        return [refs[int(k * step)] for k in range(REFS_MAX)]

    words = {}
    # Every word gets a full page; the words in its family get one too, without a family of their own (depth 1).
    def entry(s, depth=0):
        s = base(s)
        if s in words and (depth or 'family' in words[s]): return
        lex = HB if s[0] == 'H' else GB
        # A tagged Bible may give the plain number (H3820) where the lexicon splits it (H3820a heart, H3820b ...):
        # the first split stands in, saved under the number asked for.
        r = lex.get(s) or next((lex[k] for k in sorted(lex) if num(k) == s), None)
        if not r: return
        e = {'w': r[3], 't': translit(r[4]), 'g': r[6].split(':')[0].strip(), 'n': count(s)}
        st = (SH if s[0] == 'H' else SG).get(strongs_key(s), {})
        e['senses'] = hebrew_senses(r[7]) if s[0] == 'H' else greek_senses(r[7])
        if s[0] == 'G': e['lex'] = clean(r[7])
        e['strongs'] = {'id': strongs_key(s), 'def': (st.get('strongs_def') or '').strip(), 'kjv': (st.get('kjv_def') or '').strip(' .'),
                        'from': re.sub(r'\s+', ' ', st.get('derivation') or '').strip(' ;')}
        e['refs'] = spread(where.get(num(s), []))
        if not depth:
            fam, root = family(s)
            e['root'], e['family'] = root, fam
            for f in fam: entry(f, depth=1)
        words[s] = {**words.get(s, {}), **e}

    orig_path = os.path.join(ROOT, 'data', 'original.json')
    orig = json.load(open(orig_path, encoding='utf8'))
    fixed = 0
    for ref, v in orig['verses'].items():
        for w in v['words']:
            if not w.get('key'): continue
            entry(w['s'])
            if v['lang'] == 'greek':
                heb = [{'w': HB[i][3], 't': translit(HB[i][4]), 'g': HB[i][6].split(':')[0].strip(), 's': i} for i in lxx(w['s'])]
                if [x['w'] for x in heb] != [x['w'] for x in w.get('heb', [])]: fixed += 1
                w['heb'] = heb                                   # a list, empty when the Septuagint has none
                for x in heb: entry(x['s'])
    orig['source'] = orig['source'].replace('heb = the Hebrew word(s) the Greek stands for in the Septuagint',
                                            'heb = the Hebrew word(s) the Greek stands for in the Septuagint, each with its Strong\'s number (s)')
    json.dump(orig, open(orig_path, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    out_dir = os.path.join(ROOT, 'data', 'words')
    os.makedirs(out_dir, exist_ok=True)
    for f in glob.glob(os.path.join(out_dir, '*.json')): os.remove(f)
    for s, e in words.items():
        json.dump(e, open(os.path.join(out_dir, f'{s}.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(out_dir, 'SOURCE.md'), 'w', encoding='utf8').write(
        "One file per word for the word page, built by tools/lexicon.py.\n\n"
        "STEPBible.org (Tyndale House Cambridge), CC BY 4.0: TBESH and TBESG lexicons (Greek senses from Abbott-Smith), "
        "TAHOT and TAGNT for counts and verses (Greek counts follow the Textus Receptus). Strong's dictionaries (1894; "
        "Open Scriptures JSON, CC BY-SA) for Strong's definitions, KJV renderings and root links.\n\n"
        "n = verses the word appears in; refs = those verses (up to 60, spread across the Bible when there are more).\n")
    print(f'{len(words)} words; Hebrew behind changed for {fixed} Greek key words')


if __name__ == '__main__':
    main()
