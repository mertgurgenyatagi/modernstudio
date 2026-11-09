"""Writes the numbers the prototype finds in the eleven album files (tempo, meter, pickup shift, bars,
mapping, snapped note counts, dropped drum hits, octave moves) to src/core/midi/fixtures/import.json, so
that the TypeScript converter (src/core/midi/) can be tested against them. Run from anywhere:

    python tools/midi-prototype/dump.py

Where the document (docs/midi-import.md) has a rule the prototype lacks (the same-pitch overlap rule, the
span for the tempo, the pickup shift), this script applies the rule in its own plain Python, so the fixture
holds both: the prototype's own figure ("proto..." keys) and the figure by the document. Not part of the app.
"""
import json, os, sys
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline import PICKS, path_of, dominant_tempo, guess_mapping, quantize, drum_notes
import fretting as fr
from midilib import parse

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'core', 'midi', 'fixtures', 'import.json')
KEYS = (36, 84)


def doc_tempo(m, lo, hi):
    """Dominant tempo between the first note and the end of the last, by the document."""
    steps = sorted(m['tempos'])
    if not steps or steps[0][0] > 0:
        steps = [(0, 500000)] + steps
    weight = {}
    for i, (t, us) in enumerate(steps):
        nxt = steps[i + 1][0] if i + 1 < len(steps) else float('inf')
        a, b = max(t, lo), min(nxt, hi)
        if b > a:
            bpm = int(60e6 / us + 0.5)
            weight[bpm] = weight.get(bpm, 0) + (b - a)
    best = max(weight.items(), key=lambda kv: kv[1])[0] if weight else 120
    return min(300, max(40, best)), len(weight) - 1


def doc_meter(m, lo, hi):
    """(numerator, denominator, start tick of the first stretch of the dominant meter)."""
    sigs = sorted((t, n, d) for t, n, d in m['timesigs'])
    if not sigs or sigs[0][0] > 0:
        sigs = [(0, 4, 4)] + sigs
    seen = {}
    start_of = {}
    for i, (t, n, d) in enumerate(sigs):
        nxt = sigs[i + 1][0] if i + 1 < len(sigs) else hi
        a, b = max(t, lo), min(nxt, hi)
        start_of.setdefault((n, d), t)
        if b > a:
            seen[(n, d)] = seen.get((n, d), 0) + (b - a)
    key = max(seen.items(), key=lambda kv: kv[1])[0]
    return key[0], key[1], start_of[key]


def normalize(notes):
    """The same-pitch rules of the document: same start joins (longer stays); an earlier note ends where
    the same pitch starts again; shorter than 2 twelfths after that, it goes."""
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


def moved_at(notes, tuning, frets=None):
    lo, hi = (KEYS if frets is None else (tuning[0], tuning[-1] + frets))
    count = 0
    for _, _, p in notes:
        if p > hi or p < lo:
            count += 1
    return count


out = {}
for song, short in PICKS.items():
    m = parse(path_of(short))
    ppq = m['ppq']
    all_notes = [n for t in m['tracks'] for n in t['notes']]
    lo, hi = min(n[0] for n in all_notes), max(n[1] for n in all_notes)
    proto_bpm, proto_tempos = dominant_tempo(m, hi)
    bpm, other = doc_tempo(m, lo, hi)
    num, den, main_start = doc_meter(m, lo, hi)
    bar = ppq * num
    shift = (bar - main_start % bar) % bar
    k = 12 / ppq
    bar_tw = 12 * num
    mapping, skipped = guess_mapping(m)
    entry = dict(
        song=song, bpm=bpm, protoBpm=proto_bpm, otherTempos=other, protoTempoCount=proto_tempos,
        meter=[num, den], shift=shift,
        mapping={inst: [x['i'] for x in tracks] for inst, tracks in mapping.items()},
        skipped=[x['i'] for x in skipped],
        trackCount=len(m['tracks']),
        instruments={},
    )
    last_start = 0
    # drums
    hits, dropped = [], Counter()
    for t in mapping['Drums']:
        r, d = drum_notes([(s + shift, e + shift, p, c, v) for s, e, p, c, v in t['notes']], ppq)
        hits += r
        dropped += d
    hits = sorted(set(hits))
    last_start = max([last_start] + [h[0] for h in hits])
    entry['instruments']['drums'] = dict(hits=len(hits), dropped={str(k2): v for k2, v in sorted(dropped.items())},
                                         droppedTotal=sum(dropped.values()))
    for inst, key, tuning in (('Bass', 'bass', fr.BASS), ('Rhythm Guitar', 'rhythm', fr.GUITAR),
                              ('Lead Guitar', 'lead', fr.GUITAR), ('Keys', 'keys', None)):
        tracks = mapping[inst]
        if not tracks:
            continue
        q, errs = quantize([(s + shift, e + shift, p, c, v) for s, e, p, c, v in tracks[0]['notes']], ppq)
        proto = sorted(set(q))
        rules = normalize(q)
        last_start = max([last_start] + [s for s, _, _ in rules])
        if tuning is None:
            moved = {'keys': moved_at(rules, None)}
            proto_moved = {'keys': moved_at(proto, None)}
        else:
            moved = {str(f): moved_at(rules, tuning, f) for f in (5, 7, 12)}
            proto_moved = {str(f): moved_at(proto, tuning, f) for f in (5, 7, 12)}
        entry['instruments'][key] = dict(protoNotes=len(proto), notes=len(rules), moved=moved, protoMoved=proto_moved,
                                         maxError=max(errs))
    entry['bars'] = last_start // bar_tw + 1
    out[short] = entry

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
    f.write('\n')
print('wrote', os.path.normpath(OUT), len(out), 'files')
for short, e in out.items():
    print(f"{e['song']:20s} bpm {e['bpm']} (proto {e['protoBpm']}) meter {e['meter']} shift {e['shift']} bars {e['bars']}",
          {k2: (v.get('notes', v.get('hits')), v.get('protoNotes', v.get('hits'))) for k2, v in e['instruments'].items()})
