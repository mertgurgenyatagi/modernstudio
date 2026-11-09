"""Writes the prototype's tiling figures for the eleven album files (per instrument: notes, the distinct
patterns with their lengths, the block list, notes cut at a block edge, and a hash of every pattern's
notes) to src/core/midi/fixtures/chunk.json, so that the TypeScript port (src/core/midi/chunk.ts and
build.ts) can be tested against them. Run from anywhere:

    python tools/midi-prototype/dump_chunk.py

The input is the same the TypeScript gets: snapped notes with the same-pitch rules of the document applied,
folded into the range of the chosen fret count (and applied again), the prototype's tiling with weights 1
and 6. Drum rows get the app's names. Not part of the app.
"""
import hashlib, json, os, sys
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline import PICKS, path_of, guess_mapping, quantize, drum_notes
import fretting as fr
import chunk as ck
from midilib import parse

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'core', 'midi', 'fixtures', 'chunk.json')
KEYS = (36, 84)
ROW = {'kick': 'kick', 'snare': 'snare', 'hat': 'hihat', 'open': 'openHihat', 'crash': 'crash'}


def normalize(notes):
    """The same-pitch rules of the document (as in dump.py)."""
    by_pitch = defaultdict(dict)
    for s, l, p in notes:
        by_pitch[p][s] = max(l, by_pitch[p].get(s, 0))
    out = []
    for p, starts in by_pitch.items():
        ordered = sorted(starts.items())
        for i, (s, l) in enumerate(ordered):
            if i + 1 < len(ordered) and s + l > ordered[i + 1][0]:
                l = ordered[i + 1][0] - s
                if l < 2:
                    continue
            out.append((s, l, p))
    return sorted(out, key=lambda n: (n[0], n[2]))


def fold_keys(p):
    while p > KEYS[1]:
        p -= 12
    while p < KEYS[0]:
        p += 12
    return p


def summarise(notes, bar_tw):
    lane = ck.Lane(notes, bar_tw)
    blocks, pats = ck.tile(lane, 1.0, 6.0)
    ordered = sorted(pats.items(), key=lambda kv: kv[1])
    digest = hashlib.sha1('|'.join(';'.join(f'{s},{l},{k}' for s, l, k in sg) for (L, sg), _ in ordered).encode()).hexdigest()
    return dict(
        notes=len(notes), bars=lane.n_bars, patterns=len(pats), blocks=len(blocks),
        blockList=[[b, L] for b, L in blocks], patternBars=[L for (L, _), _ in ordered],
        clipped=ck.clipped(lane, blocks), hash=digest,
    ), lane, blocks, pats


with open(os.path.join(os.path.dirname(OUT), 'import.json'), encoding='utf-8') as f:
    imported = json.load(f)

out = {}
for song, short in PICKS.items():
    m = parse(path_of(short))
    ppq = m['ppq']
    shift = imported[short]['shift']
    bar_tw = 12 * imported[short]['meter'][0]
    mapping, _ = guess_mapping(m)
    entry = {}
    hits = []
    for t in mapping['Drums']:
        r, _ = drum_notes([(s + shift, e + shift, p, c, v) for s, e, p, c, v in t['notes']], ppq)
        hits += r
    hits = sorted(set((s, 0, ROW[row]) for s, _, row in hits))
    if hits:
        entry['drums'] = summarise(hits, bar_tw)[0]
    for inst, key, tuning in (('Bass', 'bass', fr.BASS), ('Rhythm Guitar', 'rhythm', fr.GUITAR),
                              ('Lead Guitar', 'lead', fr.GUITAR), ('Keys', 'keys', None)):
        tracks = mapping[inst]
        if not tracks:
            continue
        q, _ = quantize([(s + shift, e + shift, p, c, v) for s, e, p, c, v in tracks[0]['notes']], ppq)
        notes = normalize(q)
        extra = {}
        if tuning is None:
            folded = normalize([(s, l, fold_keys(p)) for s, l, p in notes])
        else:
            F, _ = fr.choose_fret_count(notes, tuning)
            folded = normalize([(s, l, fr.fold(p, tuning, F)[0]) for s, l, p in notes])
            extra['fretCount'] = F
        res, lane, blocks, pats = summarise(folded, bar_tw)
        res.update(extra)
        if tuning is not None:
            shared = 0
            for (L, sg), pid in pats.items():
                placed, _ = fr.assign(list(sg), tuning, extra['fretCount'])
                shared += fr.metrics(placed, tuning)['dup']
            res['sharedStringChords'] = shared
        entry[key] = res
        print(f"{song:20s} {key:7s} {len(folded):5d} notes  patterns {res['patterns']:2d} blocks {res['blocks']:2d}")
    out[short] = entry

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
    f.write('\n')
print('wrote', os.path.normpath(OUT))
