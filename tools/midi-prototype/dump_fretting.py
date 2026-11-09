"""Writes the prototype's fingering figures for the eleven album files (the chosen fret count, the penalty
at 5, 7 and 12 frets, the metrics and a hash of the whole fingering at the chosen count) to
src/core/midi/fixtures/fretting.json, so that the TypeScript port (src/core/midi/fretting.ts) can be tested
against them. Run from anywhere:

    python tools/midi-prototype/dump_fretting.py

The notes are the snapped notes with the same-pitch rules of the document applied (the same input the
TypeScript step gets), whole tracks. Not part of the app.
"""
import hashlib, json, os, sys, time
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline import PICKS, path_of, guess_mapping, quantize
import fretting as fr
from midilib import parse

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'core', 'midi', 'fixtures', 'fretting.json')


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


def digest(result):
    return hashlib.sha1(';'.join(f'{s},{l},{sx},{fx}' for s, l, sx, fx in result).encode()).hexdigest()


with open(os.path.join(os.path.dirname(OUT), 'import.json'), encoding='utf-8') as f:
    imported = json.load(f)

out = {}
for song, short in PICKS.items():
    m = parse(path_of(short))
    ppq = m['ppq']
    shift = imported[short]['shift']
    mapping, _ = guess_mapping(m)
    entry = {}
    for inst, key, tuning in (('Bass', 'bass', fr.BASS), ('Rhythm Guitar', 'rhythm', fr.GUITAR), ('Lead Guitar', 'lead', fr.GUITAR)):
        tracks = mapping[inst]
        if not tracks:
            continue
        q, _ = quantize([(s + shift, e + shift, p, c, v) for s, e, p, c, v in tracks[0]['notes']], ppq)
        notes = normalize(q)
        t0 = time.time()
        F, pens = fr.choose_fret_count(notes, tuning)
        res, st = fr.assign(notes, tuning, F)
        mt = fr.metrics(res, tuning)
        entry[key] = dict(
            notes=len(notes), fretCount=F, penalties={str(k): v for k, v in pens.items()},
            folded=st['folded'], placed=len(res), groups=mt['groups'], shared=mt['dup'], wide=mt['wide'],
            ringing=mt['ringcol'], open=mt['open'], high=mt['high'], move=mt['move'], hash=digest(res),
        )
        print(f"{song:20s} {key:7s} {len(notes):5d} notes  frets {F:2d}  pens {pens}  {time.time() - t0:.1f}s")
    out[short] = entry

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
    f.write('\n')
print('wrote', os.path.normpath(OUT))
