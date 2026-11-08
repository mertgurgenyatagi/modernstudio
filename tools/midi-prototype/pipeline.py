"""Reference prototype of the MIDI import pipeline: parse -> map -> time -> quantize. Not part of the app, see docs/midi-import.md."""
import os, sys, glob
from collections import Counter, defaultdict
sys.path.insert(0, os.path.dirname(__file__))
from midilib import parse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'midis')
PICKS = {
    'Is This It': 'Is This it (2)',
    'The Modern Age': 'The Modern Age (5)',
    'Soma': 'Soma (8)',
    'Barely Legal': 'Barely Legal (2)',
    'Someday': 'Someday (6)',
    'Alone Together': 'Alone Together (6)',
    'Last Nite': 'Last Night (8)',
    'Hard to Explain': 'Hard to Explain (5)',
    'New York City Cops': 'New York City Cops (4)',
    'Trying Your Luck': 'Trying Your Luck (2)',
    'Take It or Leave It': 'Take it Or Leave it (2)',
}


def path_of(short):
    for p in glob.glob(os.path.join(ROOT, '*.mid')):
        s = os.path.basename(p).replace('Strokes (The) — ', '').replace(' [MIDIfind.com].mid', '')
        if s == short:
            return p


# ---------- 1. tempo & meter ----------
def dominant_tempo(m, end_tick):
    tempos = sorted(m['tempos']) or [(0, 500000)]
    if tempos[0][0] > 0:
        tempos.insert(0, (0, 500000))
    weight = Counter()
    for (t, us), nxt in zip(tempos, tempos[1:] + [(end_tick, 0)]):
        t2 = min(nxt[0], end_tick)
        if t2 > t:
            weight[round(60e6 / us)] += t2 - t
    bpm = weight.most_common(1)[0][0] if weight else 120
    return bpm, len({round(60e6 / u) for _, u in tempos})


# ---------- 2. mapping guess ----------
VOCAL = ('vocal', 'voice', 'julian', 'julien', 'casablancas', 'singer', 'sang')


def guess_mapping(m):
    ppq = m['ppq']
    bar = ppq * 4
    info = []
    for i, t in enumerate(m['tracks']):
        if not t['notes']:
            continue
        name = t['name'].lower()
        chs = {n[3] for n in t['notes']}
        prog = t['progs'][0][2] if t['progs'] else None
        bars = len({int(n[0] // bar) for n in t['notes']})
        if chs == {9}:
            kind = 'drums'
        elif 'bass' in name:
            kind = 'bass'
        elif any(k in name for k in VOCAL):
            kind = 'keys'
        elif prog is not None and 32 <= prog <= 39:
            kind = 'bass'
        elif prog is not None and 24 <= prog <= 31:
            kind = 'guitar'
        else:
            kind = 'keys'
        info.append(dict(i=i, name=t['name'], kind=kind, n=len(t['notes']), bars=bars, notes=t['notes']))
    out = {}
    skipped = []
    out['Drums'] = [x for x in info if x['kind'] == 'drums']
    for k, inst in (('bass', 'Bass'), ('keys', 'Keys')):
        c = sorted([x for x in info if x['kind'] == k], key=lambda x: (-x['n'], -x['bars']))
        out[inst] = c[:1]
        skipped += c[1:]
    g = sorted([x for x in info if x['kind'] == 'guitar'], key=lambda x: (-x['n'], -x['bars']))
    # names win
    rh = [x for x in g if 'rhythm' in x['name'].lower() or 'rythm' in x['name'].lower()]
    ld = [x for x in g if 'lead' in x['name'].lower()]
    rest = [x for x in g if x not in rh and x not in ld]
    order = rh + rest[:0]
    rhythm = (rh or rest or ld)[:1]
    rest2 = [x for x in g if x not in rhythm]
    lead = ([x for x in rest2 if x in ld] or rest2)[:1]
    out['Rhythm Guitar'] = rhythm
    out['Lead Guitar'] = lead
    skipped += [x for x in g if x not in rhythm and x not in lead]
    return out, skipped


# ---------- 3. quantize ----------
ALLOWED = [0, 2, 3, 4, 6, 8, 9, 10]  # twelfths of a quarter within a beat


def snap(tw):
    """tw = position in twelfths (float). Nearest allowed grid point (16th grid or sixth-of-quarter grid)."""
    base = int(tw // 12) * 12
    best = None
    for b in (base - 12, base, base + 12):
        for a in ALLOWED:
            p = b + a
            d = abs(tw - p)
            # tie -> straight (multiple of 3)
            key = (d, 0 if a % 3 == 0 else 1)
            if best is None or key < best[0]:
                best = (key, p)
    p = best[1]
    return p, abs(tw - p)


def quantize(notes, ppq, max_end=None):
    """notes: (start,end,pitch,ch,vel) in ticks -> list of (start_tw, len_tw, pitch) in twelfths."""
    k = 12 / ppq
    out = []
    err = []
    for s, e, p, ch, v in notes:
        qs, d = snap(s * k)
        qe, _ = snap(e * k)
        err.append(d)
        ln = max(2, qe - qs)
        out.append((qs, ln, p))
    return out, err


DRUM_ROW = {35: 'kick', 36: 'kick', 38: 'snare', 40: 'snare', 42: 'hat', 44: 'hat', 46: 'open',
            51: 'open', 59: 'open', 53: 'open', 49: 'crash', 57: 'crash'}


def drum_notes(notes, ppq):
    k = 12 / ppq
    rows = set()
    dropped = Counter()
    for s, e, p, ch, v in notes:
        r = DRUM_ROW.get(p)
        if r is None:
            dropped[p] += 1
            continue
        qs, _ = snap(s * k)
        rows.add((qs, 0, r))
    return sorted(rows), dropped


def dedupe(notes):
    return sorted(set(notes))
