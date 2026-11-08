"""Reference prototype: pitch -> (string, fret) assignment for the string layout, Viterbi over onset groups. Not part of the app, see docs/midi-import.md."""
import itertools
from collections import defaultdict

GUITAR = [40, 45, 50, 55, 59, 64]   # E2 A2 D3 G3 B3 E4
BASS = [28, 33, 38, 43]             # E1 A1 D2 G2
K = 24


def fold(pitch, tuning, F):
    lo, hi = tuning[0], tuning[-1] + F
    n = 0
    while pitch > hi:
        pitch -= 12
        n += 1
    while pitch < lo:
        pitch += 12
        n += 1
    return pitch, n


def options(pitch, tuning, F):
    return [(s, pitch - o) for s, o in enumerate(tuning) if 0 <= pitch - o <= F]


def local_cost(cand):
    """cand: tuple of (string, fret) for one chord."""
    frets = [f for _, f in cand if f > 0]
    strings = sorted(s for s, _ in cand)
    c = 0.0
    if len(frets) >= 2:
        span = max(frets) - min(frets)
        c += 2.0 * max(0, span - 3) + 8.0 * max(0, span - 4)
    if frets:
        c += 0.15 * (sum(frets) / len(frets))
    if len(cand) >= 3:
        c += 0.4 * ((strings[-1] - strings[0] + 1) - len(set(strings)))
    c += 40.0 * (len(strings) - len(set(strings)))      # two notes on one string
    return c


_cache = {}


def chord_cands(pitches, tuning, F):
    key = (pitches, tuple(tuning), F)
    if key in _cache:
        return _cache[key]
    per = [options(p, tuning, F) for p in pitches]
    # build combos with distinct strings; if impossible, allow duplicates
    out = []

    def rec(i, used, cur):
        if i == len(per):
            out.append(tuple(cur))
            return
        for o in per[i]:
            if o[0] in used:
                continue
            cur.append(o)
            used.add(o[0])
            rec(i + 1, used, cur)
            used.discard(o[0])
            cur.pop()

    rec(0, set(), [])
    if not out:
        for combo in itertools.product(*per):
            out.append(tuple(combo))
    scored = sorted(((local_cost(c), c) for c in out), key=lambda x: x[0])[:K]
    _cache[key] = scored
    return scored


def hand_pos(cand, prev_pos):
    fr = [f for _, f in cand if f > 0]
    return (sum(fr) / len(fr)) if fr else prev_pos


def assign(notes, tuning, F, use_dp=True):
    """notes: list of (start, length, pitch) in twelfths.  Returns (list of (start,len,string,fret), stats)."""
    folded = 0
    ev = defaultdict(list)
    for s, ln, p in notes:
        p2, n = fold(p, tuning, F)
        folded += n > 0
        ev[s].append((p2, ln))
    starts = sorted(ev)
    # sort pitches inside chord (low->high), dedupe identical pitch
    groups = []
    for s in starts:
        items = sorted(set(ev[s]))
        # same pitch twice -> keep the longest
        seen = {}
        for p, ln in items:
            seen[p] = max(seen.get(p, 0), ln)
        pr = sorted(seen.items())
        groups.append((s, tuple(p for p, _ in pr), tuple(l for _, l in pr)))

    # Viterbi, survivor-based ringing memory
    # state: (cost, pos, ringing{string:end}, backptr_index)
    layers = []
    prev = None
    for gi, (s, ps, ls) in enumerate(groups):
        cands = chord_cands(ps, tuning, F)
        layer = []
        for lc, cand in cands:
            if prev is None:
                layer.append([lc, hand_pos(cand, None), {}, None, cand])
                continue
            best = None
            ps_start = groups[gi - 1][0]
            dt = s - ps_start
            fac = 1.0 if dt <= 12 else max(0.25, 1.0 / (1 + (dt - 12) / 24.0))
            cfrets = [f for _, f in cand if f > 0]
            cpos = (sum(cfrets) / len(cfrets)) if cfrets else None
            cstr = sum(x for x, _ in cand) / len(cand)
            for pi, st in enumerate(prev):
                tc = st[0] + lc
                if cpos is not None and st[1] is not None:
                    tc += fac * abs(cpos - st[1])
                pstr = sum(x for x, _ in st[4]) / len(st[4])
                tc += 0.35 * abs(cstr - pstr) * fac
                # ringing collision
                for (sx, fx) in cand:
                    e = st[2].get(sx)
                    if e is not None and e > s:
                        tc += 12.0
                if best is None or tc < best[0]:
                    best = (tc, pi)
            tc, pi = best
            st = prev[pi]
            ring = {k: v for k, v in st[2].items() if v > s}
            layer.append([tc, hand_pos(cand, st[1]), None, pi, cand])
            layer[-1][2] = ring
        # update ringing with this group's notes (after choosing preds)
        for st in layer:
            for (sx, fx), ln in zip(st[4], ls):
                pass
        # need pitch<->cand alignment: cand tuples follow pitch order of ps
        for st in layer:
            ring = dict(st[2])
            for (sx, fx), ln in zip(st[4], ls):
                ring[sx] = max(ring.get(sx, 0), s + ln)
            st[2] = ring
        layers.append(layer)
        prev = layer
    # backtrack
    result = []
    if not layers:
        return [], dict(folded=folded)
    j = min(range(len(layers[-1])), key=lambda i: layers[-1][i][0])
    chosen = [None] * len(layers)
    for gi in range(len(layers) - 1, -1, -1):
        st = layers[gi][j]
        chosen[gi] = st[4]
        j = st[3] if st[3] is not None else 0
    for (s, ps, ls), cand in zip(groups, chosen):
        for (sx, fx), ln in zip(cand, ls):
            result.append((s, ln, sx, fx))
    return result, dict(folded=folded, groups=len(groups))


def baseline(notes, tuning, F):
    out = []
    folded = 0
    for s, ln, p in notes:
        p2, n = fold(p, tuning, F)
        folded += n > 0
        o = options(p2, tuning, F)
        sx, fx = min(o, key=lambda t: (t[1], t[0]))
        out.append((s, ln, sx, fx))
    return out, dict(folded=folded)


def metrics(res, tuning):
    ev = defaultdict(list)
    for s, ln, sx, fx in res:
        ev[s].append((sx, fx, ln))
    starts = sorted(ev)
    n = len(res)
    open_ = sum(1 for r in res if r[3] == 0)
    high = sum(1 for r in res if r[3] > 7)
    dup_str = sum(1 for s in starts if len({x[0] for x in ev[s]}) < len(ev[s]))
    wide = 0
    for s in starts:
        fr = [x[1] for x in ev[s] if x[1] > 0]
        if len(fr) >= 2 and max(fr) - min(fr) > 4:
            wide += 1
    # movement
    mv, cnt = 0.0, 0
    lastpos, lastt = None, None
    ring = {}
    ringcol = 0
    for s in starts:
        fr = [x[1] for x in ev[s] if x[1] > 0]
        if fr:
            pos = sum(fr) / len(fr)
            if lastpos is not None and s - lastt <= 12:
                mv += abs(pos - lastpos)
                cnt += 1
            lastpos, lastt = pos, s
        for sx, fx, ln in ev[s]:
            if ring.get(sx, 0) > s:
                ringcol += 1
        for sx, fx, ln in ev[s]:
            ring[sx] = max(ring.get(sx, 0), s + ln)
    return dict(notes=n, groups=len(starts), open=open_ / n, high=high / n, dup=dup_str, wide=wide,
                move=mv / max(1, cnt), ringcol=ringcol)


def choose_fret_count(notes, tuning):
    """Smallest of 5, 7, 12 frets whose penalty is within max(1, 0.2% of notes) of the best."""
    pens = {}
    for F in (5, 7, 12):
        res, st = assign(notes, tuning, F)
        mt = metrics(res, tuning)
        pens[F] = 3 * st['folded'] + 2 * mt['dup'] + mt['ringcol']
    tol = max(1, 0.002 * len(notes))
    best = min(pens.values())
    for F in (5, 7, 12):
        if pens[F] <= best + tol:
            return F, pens
