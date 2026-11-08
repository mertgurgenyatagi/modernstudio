"""Runs the reference prototype on the 11 picked files in midis/ and prints one block per song.

    python tools/midi-prototype/report.py

Per song: tempo, mapping, dropped drum hits, then per instrument the fret count, octave folds,
patterns, blocks and a round-trip check (the song rebuilt from patterns and blocks must equal the
quantized source). Reference only. The app's own code is written later, in TypeScript, from
docs/midi-import.md.
"""
import os, sys
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline import *
import fretting as fr
import chunk as ck

DR = {41: 'low floor tom', 43: 'high floor tom', 45: 'low tom', 47: 'low-mid tom', 48: 'hi-mid tom', 50: 'high tom',
      37: 'side stick', 39: 'clap', 52: 'china', 54: 'tambourine', 55: 'splash', 56: 'cowbell', 65: 'hi timbale', 66: 'lo timbale'}
KEYS = (36, 84)  # C2..C6


def fold_keys(p):
    n = 0
    while p > KEYS[1]:
        p -= 12; n += 1
    while p < KEYS[0]:
        p += 12; n += 1
    return p, n


summary = []
bad_total = 0
for song, short in PICKS.items():
    m = parse(path_of(short)); ppq = m['ppq']
    end = max(n[1] for t in m['tracks'] for n in t['notes'])
    bpm, ntempi = dominant_tempo(m, end)
    mp, skipped = guess_mapping(m)
    print(f"\n### {song}  <- {short}   {bpm} BPM ({ntempi} tempos in file), {end / (ppq * 4):.0f} bars")
    for inst in ('Drums', 'Bass', 'Rhythm Guitar', 'Lead Guitar', 'Keys'):
        tracks = mp[inst]
        if not tracks:
            print(f"   {inst:14s} (no track)")
            continue
        names = ' + '.join(t['name'][:22] for t in tracks)
        if inst == 'Drums':
            notes, dropped = [], Counter()
            for t in tracks:
                r, d = drum_notes(t['notes'], ppq); notes += r; dropped += d
            lane = ck.Lane(sorted(set(notes)))
            blocks, pats = ck.tile(lane, 1.0, 6.0)
            dr = ', '.join(f"{DR.get(k, k)} {v}" for k, v in dropped.most_common(4) if v >= 20) or 'nothing notable'
            print(f"   {inst:14s} {names:26s} {len(notes):5d} hits  patterns {len(pats):2d} blocks {len(blocks):2d}  dropped: {dr}")
            continue
        q, _ = quantize(tracks[0]['notes'], ppq)
        q = sorted(set(q))
        if inst == 'Keys':
            q = sorted(set((s, l, fold_keys(p)[0]) for s, l, p in q))
            folded = sum(1 for n in tracks[0]['notes'] if fold_keys(n[2])[1])
            lane = ck.Lane(q)
            blocks, pats = ck.tile(lane, 1.0, 6.0)
            print(f"   {inst:14s} {names:26s} {len(q):5d} notes patterns {len(pats):2d} blocks {len(blocks):2d}  folded {folded}")
            continue
        tuning = fr.BASS if inst == 'Bass' else fr.GUITAR
        F, _ = fr.choose_fret_count(q, tuning)
        fq, nf = [], 0
        for s, l, p in q:
            p2, n = fr.fold(p, tuning, F); nf += n > 0
            fq.append((s, l, p2))
        fq = sorted(set(fq))
        lane = ck.Lane(fq)
        blocks, pats = ck.tile(lane, 1.0, 6.0)
        dup = 0
        fingered = {}
        for (L, sg), pid in pats.items():
            res, _ = fr.assign(list(sg), tuning, F)
            fingered[pid] = res
            dup += fr.metrics(res, tuning)['dup']
        rebuilt = []
        for b, L in blocks:
            for s, l, sx, fx in fingered[pats[(L, lane.sig(b, L))]]:
                rebuilt.append((b * 48 + s, l, tuning[sx] + fx))
        a = Counter((s, p) for s, l, p in fq); r = Counter((s, p) for s, l, p in rebuilt)
        bad = sum((a - r).values()) + sum((r - a).values())
        bad_total += bad
        print(f"   {inst:14s} {names:26s} {len(fq):5d} notes patterns {len(pats):2d} blocks {len(blocks):2d}  frets {F:2d}  folded {nf:3d}  same-string pairs {dup}  round trip {'OK' if not bad else 'MISMATCH ' + str(bad)}")
        summary.append((song, inst, F, nf, len(pats), len(blocks)))
    for x in skipped:
        print(f"   skipped track {x['name'][:24]!r} ({x['n']} notes)")
print('\nround-trip mismatches:', bad_total)
print('most patterns on any one instrument:', max(s[4] for s in summary))
